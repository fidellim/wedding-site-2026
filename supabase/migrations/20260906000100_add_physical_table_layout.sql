-- Persist individual table geometry. Legacy rows and snapshots use two long sides.
-- Existing seats, assignments, published snapshots, and function privileges are retained.
alter table public.seating_tables
  add column side_counts jsonb,
  add column seat_one_position integer not null default 0,
  add constraint seating_table_first_chair_valid check (seat_one_position >= 0 and seat_one_position < capacity),
  add constraint seating_table_side_counts_valid check (
    side_counts is null or coalesce((
      jsonb_typeof(side_counts) = 'object'
      and jsonb_typeof(side_counts -> 'top') = 'number'
      and (side_counts ->> 'top') ~ '^(0|[1-9][0-9]*)$'
      and jsonb_typeof(side_counts -> 'right') = 'number'
      and (side_counts ->> 'right') ~ '^(0|[1-9][0-9]*)$'
      and jsonb_typeof(side_counts -> 'bottom') = 'number'
      and (side_counts ->> 'bottom') ~ '^(0|[1-9][0-9]*)$'
      and jsonb_typeof(side_counts -> 'left') = 'number'
      and (side_counts ->> 'left') ~ '^(0|[1-9][0-9]*)$'
      and (side_counts ->> 'top')::numeric + (side_counts ->> 'right')::numeric + (side_counts ->> 'bottom')::numeric + (side_counts ->> 'left')::numeric = capacity
    ), false)
  );

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
      'assignments', revision.snapshot -> 'assignments'
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
        'assignments', item.snapshot -> 'assignments'
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

create or replace function public.admin_upsert_seating_table(
  p_expected_version bigint,
  p_table jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_id uuid := public.require_seating_admin();
  v_table_id uuid := nullif(p_table ->> 'id', '')::uuid;
  next_capacity integer := (p_table ->> 'capacity')::integer;
begin
  perform public.lock_seating_draft(p_expected_version);
  if next_capacity is null or next_capacity not between 1 and 30 then
    raise exception 'INVALID_TABLE_CAPACITY' using errcode = 'P0001';
  end if;

  if v_table_id is null then
    insert into public.seating_tables (name, table_number, shape, capacity, seat_one_angle, side_counts, seat_one_position)
    values (
      trim(p_table ->> 'name'),
      (p_table ->> 'number')::integer,
      p_table ->> 'shape',
      next_capacity,
      coalesce((p_table ->> 'seatOneAngle')::integer, 0),
      nullif(p_table -> 'sideCounts', 'null'::jsonb),
      coalesce((p_table ->> 'seatOnePosition')::integer, 0)
    ) returning id into v_table_id;
  else
    if exists (
      select 1
      from public.seating_assignments assignment
      join public.seating_seats seat on seat.id = assignment.seat_id
      where seat.table_id = v_table_id and seat.seat_number > next_capacity
    ) then
      raise exception 'CAPACITY_WOULD_REMOVE_ASSIGNMENTS' using errcode = 'P0001';
    end if;
    update public.seating_tables
    set name = trim(p_table ->> 'name'),
        table_number = (p_table ->> 'number')::integer,
        shape = p_table ->> 'shape',
        capacity = next_capacity,
        seat_one_angle = coalesce((p_table ->> 'seatOneAngle')::integer, 0),
        side_counts = nullif(p_table -> 'sideCounts', 'null'::jsonb),
        seat_one_position = coalesce((p_table ->> 'seatOnePosition')::integer, 0),
        updated_at = now()
    where id = v_table_id
      and is_active;
    if not found then raise exception 'TABLE_NOT_FOUND' using errcode = 'P0001'; end if;
  end if;

  insert into public.seating_seats (table_id, seat_number, is_active, updated_at)
  select v_table_id, seat_no, true, now()
  from generate_series(1, next_capacity) seat_no
  on conflict (table_id, seat_number) do update
    set is_active = true,
        updated_at = now();
  update public.seating_seats
  set is_active = false,
      updated_at = now()
  where seating_seats.table_id = v_table_id
    and seat_number > next_capacity
    and is_active;

  update public.seating_plan_state
  set draft_version = draft_version + 1, updated_by = admin_id, updated_at = now()
  where singleton;
  insert into public.seating_audit_log (kind, actor_id, draft_version, details)
  select 'table_updated', admin_id, draft_version, jsonb_build_object('tableId', v_table_id)
  from public.seating_plan_state where singleton;

  return public.admin_get_seating_workspace();
end;
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
  set draft_version = draft_version + 1, updated_by = admin_id, updated_at = now()
  where singleton returning draft_version into next_version;
  insert into public.seating_audit_log (
    kind, actor_id, draft_version, revision_number
  ) values (
    'revision_restored', admin_id, next_version, selected_revision.revision_number
  );

  return public.admin_get_seating_workspace();
end;
$$;
