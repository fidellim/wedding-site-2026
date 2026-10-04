-- Additive venue placement upgrade. No production rows are removed or rewritten.
-- Apply only this migration to an already-installed seating planner.
alter table public.seating_plan_state add column venue_layout jsonb;

create function public.valid_seating_venue_layout(value jsonb)
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
    ('approachWidth', 2, 5, .25)
  ) as specifications(key, minimum, maximum, step) loop
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
alter table public.seating_plan_state add constraint seating_venue_layout_valid
  check (venue_layout is null or public.valid_seating_venue_layout(venue_layout));

create function public.admin_save_venue_layout(p_expected_version bigint, p_layout jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare admin_id uuid := public.require_seating_admin();
begin
  perform public.lock_seating_draft(p_expected_version);
  if not public.valid_seating_venue_layout(p_layout) then raise exception 'INVALID_VENUE_LAYOUT' using errcode = 'P0001'; end if;
  if exists (
    select 1 from jsonb_each(p_layout -> 'tables') as placement(table_id, geometry)
    left join public.seating_tables t on t.id::text = placement.table_id and t.is_active
    where t.id is null
  ) then raise exception 'INVALID_VENUE_TABLE' using errcode = 'P0001'; end if;
  update public.seating_plan_state set venue_layout = p_layout, draft_version = draft_version + 1,
    updated_by = admin_id, updated_at = now() where singleton;
  -- Keep the existing audit contract; store a compact marker, not another layout copy.
  insert into public.seating_audit_log(kind, actor_id, draft_version, details)
    select 'table_updated', admin_id, draft_version, jsonb_build_object('venueLayoutChanged', true)
    from public.seating_plan_state where singleton;
  return public.admin_get_seating_workspace();
end;
$$;

create or replace function public.admin_get_seating_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform public.require_seating_admin();

  select jsonb_build_object(
    'draft', jsonb_build_object(
      'id', 'draft',
      'version', state.draft_version,
      'baseRevisionNumber', revision.revision_number,
      'venueLayout', state.venue_layout,
      'invitationParties', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', invite.code,
          'label', invite.guest_name,
          'rsvpStatus', case
            when lower(coalesce(invite.rsvp_status, '')) in ('yes', 'accepted') then 'accepted'
            when lower(coalesce(invite.rsvp_status, '')) in ('no', 'declined') then 'declined'
            else 'pending'
          end,
          'attendingCount', coalesce(invite.attendees_confirmed, 0)
        ) order by invite.guest_name)
        from public.invites invite
      ), '[]'::jsonb),
      'invitees', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', invitee.id,
          'invitationPartyId', invitee.invite_code,
          'fullName', invitee.full_name,
          'attendanceStatus', invitee.attendance_status,
          'requiresSeat', invitee.requires_seat,
          'tags', to_jsonb(invitee.tags),
          'keepTogetherGroupId', invitee.keep_together_group_id,
          'privateNotes', invitee.private_notes
        ) order by invitee.full_name)
        from public.seating_invitees invitee
      ), '[]'::jsonb),
      'tables', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', seating_table.id,
          'name', seating_table.name,
          'number', seating_table.table_number,
          'shape', seating_table.shape,
          'capacity', seating_table.capacity,
          'seatOneAngle', seating_table.seat_one_angle,
          'sideCounts', coalesce(seating_table.side_counts, jsonb_build_object(
            'top', (seating_table.capacity + 1) / 2, 'right', 0,
            'bottom', seating_table.capacity / 2, 'left', 0)),
          'seatOnePosition', seating_table.seat_one_position
        ) order by seating_table.table_number)
        from public.seating_tables seating_table
        where seating_table.is_active
      ), '[]'::jsonb),
      'seats', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', seat.id,
          'tableId', seat.table_id,
          'number', seat.seat_number
        ) order by seat.table_id, seat.seat_number)
        from public.seating_seats seat
        join public.seating_tables seating_table
          on seating_table.id = seat.table_id
         and seating_table.is_active
        where seat.is_active
      ), '[]'::jsonb),
      'assignments', coalesce((
        select jsonb_agg(jsonb_build_object(
          'inviteeId', assignment.invitee_id,
          'seatId', assignment.seat_id
        ) order by assignment.seat_id)
        from public.seating_assignments assignment
        join public.seating_seats seat
          on seat.id = assignment.seat_id
         and seat.is_active
        join public.seating_tables seating_table
          on seating_table.id = seat.table_id
         and seating_table.is_active
        where assignment.seat_id is not null
      ), '[]'::jsonb)
    ),
    'published', case when revision.id is null then null else jsonb_build_object(
      'id', revision.id,
      'revisionNumber', revision.revision_number,
      'publishedAt', revision.published_at,
      'publishedBy', revision.published_by,
      'invitationParties', revision.snapshot -> 'invitationParties',
      'invitees', revision.snapshot -> 'invitees',
      'tables', revision.snapshot -> 'tables',
      'seats', revision.snapshot -> 'seats',
      'assignments', revision.snapshot -> 'assignments',
      'venueLayout', revision.snapshot -> 'venueLayout'
    ) end,
    'revisions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', item.id,
        'revisionNumber', item.revision_number,
        'publishedAt', item.published_at,
        'publishedBy', item.published_by,
        'invitationParties', item.snapshot -> 'invitationParties',
        'invitees', item.snapshot -> 'invitees',
        'tables', item.snapshot -> 'tables',
        'seats', item.snapshot -> 'seats',
        'assignments', item.snapshot -> 'assignments',
        'venueLayout', item.snapshot -> 'venueLayout'
      ) order by item.revision_number)
      from public.seating_plan_revisions item
    ), '[]'::jsonb),
    'auditLog', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', entry.id,
        'kind', entry.kind,
        'actorId', entry.actor_id,
        'occurredAt', entry.occurred_at,
        'inviteeId', entry.invitee_id,
        'fromSeatId', entry.from_seat_id,
        'toSeatId', entry.to_seat_id,
        'revisionNumber', entry.revision_number,
        'reversesAuditId', entry.reverses_audit_id
      ) order by entry.occurred_at)
      from (
        select * from public.seating_audit_log
        order by occurred_at desc
        limit 200
      ) entry
    ), '[]'::jsonb),
    'guestLookupEnabled', state.guest_lookup_enabled
  )
  into result
  from public.seating_plan_state state
  left join public.seating_plan_revisions revision
    on revision.id = state.published_revision_id
  where state.singleton;

  return result;
end;
$$;


-- Same conservative rotated chair footprints and 0.5 m clearance as the editor.
create function public.seating_venue_publication_validation()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  perform public.require_seating_admin();
  with layout as (
    select venue_layout, coalesce((venue_layout -> 'parameters' ->> 'lawnWidth')::double precision, 44) as width,
      coalesce((venue_layout -> 'parameters' ->> 'lawnLength')::double precision, 16) as depth
    from public.seating_plan_state where singleton
  ), geometry as (
    select t.id, t.name, t.shape, l.width, l.depth, l.venue_layout -> 'tables' -> t.id::text as p,
      exists(select 1 from public.seating_assignments a join public.seating_seats s on s.id = a.seat_id where s.table_id = t.id and s.is_active) as assigned
    from public.seating_tables t cross join layout l where t.is_active
  ), dimensions as (
    select *, (p ->> 'x')::double precision as x, (p ->> 'y')::double precision as y,
      (p ->> 'width')::double precision / 2 + .7 as w,
      (p ->> 'depth')::double precision / 2 + .7 as d,
      radians((p ->> 'rotation')::double precision) as angle from geometry
  ), footprints as (
    select *, case when shape = 'round' then w else w * abs(cos(angle)) + d * abs(sin(angle)) end as hw,
      case when shape = 'round' then w else w * abs(sin(angle)) + d * abs(cos(angle)) end as hd
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
    select jsonb_build_object('code', 'table_outside_venue', 'message', name || ' and its chair space extend outside the reception lawn.', 'relatedIds', jsonb_build_array(id))
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

create function public.admin_publish_seating_plan(p_expected_version bigint, p_acknowledge_layout_warnings boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  admin_id uuid := public.require_seating_admin();
  validation jsonb;
  venue_validation jsonb;
  snapshot jsonb;
  next_revision integer;
  revision_id uuid;
  next_version bigint;
begin
  perform public.lock_seating_draft(p_expected_version);
  validation := public.seating_publication_validation();
  venue_validation := public.seating_venue_publication_validation();
  if not (validation ->> 'canPublish')::boolean or not (venue_validation ->> 'canPublish')::boolean then
    raise exception 'PUBLICATION_BLOCKED:%', validation || jsonb_build_object('venue', venue_validation) using errcode = 'P0001';
  end if;
  if jsonb_array_length(venue_validation -> 'warnings') > 0 and not coalesce(p_acknowledge_layout_warnings, false) then
    raise exception 'PUBLICATION_BLOCKED: acknowledge approximate layout warnings' using errcode = 'P0001';
  end if;
  select coalesce(max(revision_number), 0) + 1 into next_revision from public.seating_plan_revisions;
  snapshot := (public.admin_get_seating_workspace() -> 'draft') - 'id' - 'version' - 'baseRevisionNumber';
  insert into public.seating_plan_revisions(revision_number, snapshot, published_by, published_at)
    values(next_revision, snapshot, admin_id, now()) returning id into revision_id;
  update public.seating_plan_state set draft_version = draft_version + 1, published_revision_id = revision_id,
    updated_by = admin_id, updated_at = now() where singleton returning draft_version into next_version;
  insert into public.seating_audit_log(kind, actor_id, draft_version, revision_number, details)
    values('plan_published', admin_id, next_version, next_revision, jsonb_build_object('layoutWarningsAcknowledged', coalesce(p_acknowledge_layout_warnings, false)));
  return public.admin_get_seating_workspace();
end;
$$;

-- Retain the old signature and permissions while enforcing the new publication gate.
create or replace function public.admin_publish_seating_plan(p_expected_version bigint)
returns jsonb language sql security definer set search_path = '' as $$
  select public.admin_publish_seating_plan(p_expected_version, false);
$$;
create or replace function public.admin_restore_seating_revision(
  p_expected_version bigint,
  p_revision_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_id uuid := public.require_seating_admin();
  selected_revision public.seating_plan_revisions%rowtype;
  next_version bigint;
begin
  perform public.lock_seating_draft(p_expected_version);
  select * into selected_revision from public.seating_plan_revisions where id = p_revision_id;
  if not found then raise exception 'REVISION_NOT_FOUND' using errcode = 'P0001'; end if;

  update public.seating_assignments
  set seat_id = null,
      assigned_by = admin_id,
      assigned_at = now()
  where seat_id is not null;
  update public.seating_seats
  set is_active = false,
      updated_at = now()
  where is_active;
  update public.seating_tables
  set is_active = false,
      updated_at = now()
  where is_active;

  insert into public.seating_tables (
    id,
    name,
    table_number,
    shape,
    capacity,
    seat_one_angle,
    side_counts,
    seat_one_position,
    is_active,
    updated_at
  )
  select id, name, number, shape, capacity, "seatOneAngle", nullif("sideCounts", 'null'::jsonb), coalesce("seatOnePosition", 0), true, now()
  from jsonb_to_recordset(selected_revision.snapshot -> 'tables') as item(
    id uuid,
    name text,
    number integer,
    shape text,
    capacity integer,
    "seatOneAngle" integer,
    "sideCounts" jsonb,
    "seatOnePosition" integer
  )
  on conflict (id) do update
    set name = excluded.name,
        table_number = excluded.table_number,
        shape = excluded.shape,
        capacity = excluded.capacity,
        seat_one_angle = excluded.seat_one_angle,
        side_counts = excluded.side_counts,
        seat_one_position = excluded.seat_one_position,
        is_active = true,
        updated_at = now();
  insert into public.seating_seats (id, table_id, seat_number, is_active, updated_at)
  select id, "tableId", number, true, now()
  from jsonb_to_recordset(selected_revision.snapshot -> 'seats') as item(
    id uuid,
    "tableId" uuid,
    number integer
  )
  on conflict (id) do update
    set table_id = excluded.table_id,
        seat_number = excluded.seat_number,
        is_active = true,
        updated_at = now();
  insert into public.seating_assignments (invitee_id, seat_id, assigned_by, assigned_at)
  select item."inviteeId", item."seatId", admin_id, now()
  from jsonb_to_recordset(selected_revision.snapshot -> 'assignments') as item(
    "inviteeId" uuid,
    "seatId" uuid
  )
  join public.seating_invitees invitee on invitee.id = item."inviteeId"
    and invitee.attendance_status = 'confirmed'
    and invitee.requires_seat
  join public.seating_seats seat on seat.id = item."seatId" and seat.is_active
  join public.seating_tables seating_table
    on seating_table.id = seat.table_id
   and seating_table.is_active
  on conflict (invitee_id) do update
    set seat_id = excluded.seat_id,
        assigned_by = excluded.assigned_by,
        assigned_at = excluded.assigned_at;

  update public.seating_plan_state
  set draft_version = draft_version + 1, venue_layout = nullif(selected_revision.snapshot -> 'venueLayout', 'null'::jsonb), updated_by = admin_id, updated_at = now()
  where singleton returning draft_version into next_version;
  insert into public.seating_audit_log (
    kind, actor_id, draft_version, revision_number
  ) values (
    'revision_restored', admin_id, next_version, selected_revision.revision_number
  );

  return public.admin_get_seating_workspace();
end;
$$;

revoke all on function public.valid_seating_venue_layout(jsonb) from public, anon, authenticated;
revoke all on function public.seating_venue_publication_validation() from public, anon, authenticated;
revoke all on function public.admin_save_venue_layout(bigint, jsonb) from public, anon;
revoke all on function public.admin_publish_seating_plan(bigint, boolean) from public, anon;
grant execute on function public.admin_save_venue_layout(bigint, jsonb) to authenticated;
grant execute on function public.admin_publish_seating_plan(bigint, boolean) to authenticated;

-- Expose the new RPC signatures as soon as this migration commits.
-- Notifications in rollback-only validation are discarded by PostgreSQL.
notify pgrst, 'reload schema';
