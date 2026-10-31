-- Add optional event furniture without rewriting guest tables, seats, assignments, or revisions.
create or replace function public.valid_seating_venue_layout(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  spec record;
  point jsonb;
  item jsonb;
  axis text;
begin
  if value is null or jsonb_typeof(value) <> 'object'
    or jsonb_typeof(value -> 'parameters') is distinct from 'object'
    or jsonb_typeof(value -> 'tables') is distinct from 'object'
    or jsonb_typeof(value -> 'landmarks') is distinct from 'object'
    or coalesce(value ->> 'led', '') not in ('center', 'side')
    or octet_length(value::text) > 65536 then return false; end if;
  for spec in select * from (values
    ('stageWidth', 4, 9, .5),
    ('stageDepth', 2, 5, .5),
    ('stageHeight', .2, .4, .05),
    ('backdropHeight', 2.4, 4, .1),
    ('danceFloorSize', 4, 9, .5),
    ('lawnWidth', 24, 70, 1),
    ('lawnLength', 10, 36, 1),
    ('waterSetback', 3, 20, .5),
    ('waterfrontEdgeHeight', .05, .5, .05),
    ('terraceDepth', 10, 22, .5),
    ('terraceHeight', .4, 2, .1),
    ('stairWidth', 5, 16, .5),
    ('stairCount', 4, 12, 1),
    ('stairTread', .3, .7, .02),
    ('pavilionDiameter', 6, 12, .5),
    ('pavilionColumns', 8, 16, 2),
    ('pavilionColumnHeight', 2.5, 4.5, .1),
    ('pavilionRoofRise', 1, 2.8, .1),
    ('pavilionFloorOffset', 0, .4, .02),
    ('pavilionLawnGap', 1, 5, .5),
    ('ceremonyStructureDiameter', 2, 4, .25),
    ('ceremonyStructureHeight', .5, 1.4, .1),
    ('plazaWidth', 12, 26, 1),
    ('plazaLength', 14, 30, 1),
    ('approachWidth', 2, 5, .25),
    ('approachLength', 24, 72, 2),
    ('pavilionPlazaGap', 5.5, 9, .5),
    ('bridgeHeight', 1.6, 3, .1),
    ('bridgeStepCount', 10, 18, 1),
    ('bridgeTread', .26, .4, .02)
  ) as specifications(key, minimum, maximum, step) loop
    -- Old drafts and immutable published revisions may omit the new estimates.
    if spec.key in ('approachLength', 'pavilionPlazaGap', 'bridgeHeight', 'bridgeStepCount', 'bridgeTread')
      and not ((value -> 'parameters') ? spec.key) then continue; end if;
    if jsonb_typeof(value -> 'parameters' -> spec.key) is distinct from 'number'
      or (value -> 'parameters' ->> spec.key)::numeric not between spec.minimum and spec.maximum
      or mod((value -> 'parameters' ->> spec.key)::numeric - spec.minimum, spec.step) <> 0 then return false; end if;
  end loop;
  foreach axis in array array['stage', 'danceFloor', 'entrance'] loop
    point := value -> 'landmarks' -> axis;
    if jsonb_typeof(point) is distinct from 'object'
      or jsonb_typeof(point -> 'x') is distinct from 'number'
      or jsonb_typeof(point -> 'y') is distinct from 'number'
      or abs((point ->> 'x')::numeric) > 200 or abs((point ->> 'y')::numeric) > 200 then return false; end if;
  end loop;
  -- Event furniture is optional for legacy drafts and immutable revisions.
  if value ? 'eventFurniture' then
    if jsonb_typeof(value -> 'eventFurniture') is distinct from 'object' then return false; end if;
    if exists (select 1 from jsonb_object_keys(value -> 'eventFurniture') as keys(key)
      where key not in ('couple', 'cake')) then return false; end if;
    if (value -> 'eventFurniture') ? 'cake' and
      (value -> 'eventFurniture' -> 'cake' -> 'width') is distinct from
      (value -> 'eventFurniture' -> 'cake' -> 'depth') then return false; end if;
  end if;
  for item in select item_value from jsonb_each((value -> 'tables') || coalesce(value -> 'eventFurniture', '{}'::jsonb)) as items(item_key, item_value) loop
    if jsonb_typeof(item) <> 'object' then return false; end if;
    foreach axis in array array['x', 'y', 'rotation', 'width', 'depth'] loop
      if jsonb_typeof(item -> axis) is distinct from 'number' then return false; end if;
    end loop;
    if abs((item ->> 'x')::numeric) > 200 or abs((item ->> 'y')::numeric) > 200
      or (item ->> 'rotation')::numeric < 0 or (item ->> 'rotation')::numeric >= 360
      or (item ->> 'width')::numeric not between .5 and 10
      or (item ->> 'depth')::numeric not between .5 and 10
      or jsonb_typeof(item -> 'dimensionsVerified') is distinct from 'boolean' then return false; end if;
  end loop;
  return true;
exception when others then return false;
end;
$$;

create or replace function public.seating_venue_publication_validation()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  perform public.require_seating_admin();
  with layout as (
    select venue_layout, coalesce((venue_layout -> 'parameters' ->> 'lawnWidth')::double precision, 44) as width,
      coalesce((venue_layout -> 'parameters' ->> 'lawnLength')::double precision, 16) as depth
    from public.seating_plan_state where singleton
  ), geometry as (
    select t.id::text as id, t.name, t.shape, l.width, l.depth, l.venue_layout -> 'tables' -> t.id::text as p,
      exists(select 1 from public.seating_assignments a join public.seating_seats s on s.id = a.seat_id where s.table_id = t.id and s.is_active) as assigned
    from public.seating_tables t cross join layout l where t.is_active
    union all
    select fixture.kind, case when fixture.kind = 'couple' then 'Couple’s table' else 'Cake table' end,
      fixture.kind, l.width, l.depth, fixture.p, true
    from layout l cross join lateral jsonb_each(coalesce(l.venue_layout -> 'eventFurniture', '{}'::jsonb)) as fixture(kind, p)
  ), dimensions as (
    select *, (p ->> 'x')::double precision - case when shape = 'couple' then .375 * sin(radians((p ->> 'rotation')::double precision)) else 0 end as x,
      (p ->> 'y')::double precision + case when shape = 'couple' then .375 * cos(radians((p ->> 'rotation')::double precision)) else 0 end as y,
      case when shape = 'couple' then greatest((p ->> 'width')::double precision / 2, least(.45, (p ->> 'width')::double precision / 4) + .23)
        else (p ->> 'width')::double precision / 2 + case when shape = 'cake' then 0 else .7 end end as w,
      (p ->> 'depth')::double precision / 2 + case when shape = 'couple' then .375 when shape = 'cake' then 0 else .7 end as d,
      radians((p ->> 'rotation')::double precision) as angle from geometry
  ), footprints as (
    select *, case when shape in ('round', 'cake') then w else w * abs(cos(angle)) + d * abs(sin(angle)) end as hw,
      case when shape in ('round', 'cake') then w else w * abs(sin(angle)) + d * abs(cos(angle)) end as hd
    from dimensions
  ), obstacles as (
    select 'stage'::text as label, (venue_layout -> 'landmarks' -> 'stage' ->> 'x')::double precision as x,
      (venue_layout -> 'landmarks' -> 'stage' ->> 'y')::double precision as y,
      (case when venue_layout ->> 'led' = 'center' then greatest(8, (venue_layout -> 'parameters' ->> 'stageWidth')::double precision)
        else (venue_layout -> 'parameters' ->> 'stageWidth')::double precision end) / 2 as hw,
      (venue_layout -> 'parameters' ->> 'stageDepth')::double precision / 2 as hd from layout
    union all
    select 'dance floor', (venue_layout -> 'landmarks' -> 'danceFloor' ->> 'x')::double precision,
      (venue_layout -> 'landmarks' -> 'danceFloor' ->> 'y')::double precision,
      (venue_layout -> 'parameters' ->> 'danceFloorSize')::double precision / 2,
      (venue_layout -> 'parameters' ->> 'danceFloorSize')::double precision / 2 from layout
  ), errors as (
    select jsonb_build_object('code', 'table_unplaced', 'message', name || ' has assigned guests but has not been placed.', 'relatedIds', jsonb_build_array(id)) as issue
      from footprints where assigned and p is null
    union all
    select jsonb_build_object('code', 'table_outside_venue', 'message', name || case when shape in ('couple', 'cake') then ' and its furniture extend outside the reception lawn.' else ' and its chair space extend outside the reception lawn.' end, 'relatedIds', jsonb_build_array(id))
      from footprints where assigned and (abs(x) + hw > width / 2 + .000001 or abs(y) + hd > depth / 2 + .000001)
  ), warnings as (
    select jsonb_build_object('code', 'layout_clearance', 'message', a.name || ' and ' || b.name || ' may overlap or have less than 0.5 m clearance.', 'relatedIds', jsonb_build_array(a.id, b.id)) as issue
    from footprints a join footprints b on a.id < b.id
      and abs(a.x - b.x) < a.hw + b.hw + .5 and abs(a.y - b.y) < a.hd + b.hd + .5
    union all
    select jsonb_build_object('code', 'layout_clearance', 'message', f.name || ' may overlap or be too close to the ' || o.label || '.', 'relatedIds', jsonb_build_array(f.id))
    from footprints f cross join obstacles o
    where abs(f.x - o.x) < f.hw + o.hw + .5 and abs(f.y - o.y) < f.hd + o.hd + .5
  ) select jsonb_build_object('canPublish', not exists(select 1 from errors),
    'errors', coalesce((select jsonb_agg(issue) from errors), '[]'::jsonb),
    'warnings', coalesce((select jsonb_agg(issue) from warnings), '[]'::jsonb)) into result;
  return result;
end;
$$;

notify pgrst, 'reload schema';
