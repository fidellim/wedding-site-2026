-- Validate optional reconstruction estimates without rewriting any stored layout.
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
  for item in select item_value from jsonb_each(value -> 'tables') as items(item_key, item_value) loop
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
