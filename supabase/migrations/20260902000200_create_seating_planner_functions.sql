create function public.require_seating_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or not public.is_seating_admin() then
    raise exception 'Seating administrator access required' using errcode = '42501';
  end if;
  return current_user_id;
end;
$$;

create function public.lock_seating_draft(p_expected_version bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_version bigint;
begin
  perform public.require_seating_admin();
  select draft_version
    into current_version
  from public.seating_plan_state
  where singleton
  for update;

  if current_version <> p_expected_version then
    raise exception 'STALE_VERSION:%', current_version using errcode = 'P0001';
  end if;
  return current_version;
end;
$$;

create function public.resolve_seating_invite_code(p_code text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select invite.code
  from public.invites invite
  where lower(trim(invite.code)) = lower(trim(p_code))
  limit 1;
$$;

create function public.admin_get_seating_workspace()
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
          'seatOneAngle', seating_table.seat_one_angle
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

create function public.seating_publication_validation()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  errors jsonb;
  warnings jsonb;
begin
  perform public.require_seating_admin();

  select coalesce(jsonb_agg(issue), '[]'::jsonb)
    into errors
  from (
    select jsonb_build_object(
      'code', 'attendance_count_mismatch',
      'message', format(
        '%s has %s named attendees but its RSVP count is %s.',
        invite.guest_name,
        count(invitee.id) filter (where invitee.attendance_status = 'confirmed'),
        case
          when lower(coalesce(invite.rsvp_status, '')) in ('yes', 'accepted')
            then coalesce(invite.attendees_confirmed, 0)
          else 0
        end
      ),
      'relatedIds', jsonb_build_array(invite.code)
    ) as issue
    from public.invites invite
    left join public.seating_invitees invitee on invitee.invite_code = invite.code
    group by invite.code, invite.guest_name, invite.rsvp_status, invite.attendees_confirmed
    having count(invitee.id) filter (where invitee.attendance_status = 'confirmed') <>
      case
        when lower(coalesce(invite.rsvp_status, '')) in ('yes', 'accepted')
          then coalesce(invite.attendees_confirmed, 0)
        else 0
      end

    union all

    select jsonb_build_object(
      'code', 'unassigned_attendee',
      'message', invitee.full_name || ' still needs a seat.',
      'relatedIds', jsonb_build_array(invitee.id)
    )
    from public.seating_invitees invitee
    left join public.seating_assignments assignment
      on assignment.invitee_id = invitee.id
     and assignment.seat_id is not null
    left join public.seating_seats assigned_seat
      on assigned_seat.id = assignment.seat_id
     and assigned_seat.is_active
    left join public.seating_tables assigned_table
      on assigned_table.id = assigned_seat.table_id
     and assigned_table.is_active
    where invitee.attendance_status = 'confirmed'
      and invitee.requires_seat
      and (assignment.invitee_id is null or assigned_table.id is null)

    union all

    select jsonb_build_object(
      'code', 'ineligible_assignment',
      'message', invitee.full_name || ' is not eligible for an assigned seat.',
      'relatedIds', jsonb_build_array(invitee.id, assignment.seat_id)
    )
    from public.seating_assignments assignment
    join public.seating_invitees invitee on invitee.id = assignment.invitee_id
    join public.seating_seats seat on seat.id = assignment.seat_id
    join public.seating_tables seating_table on seating_table.id = seat.table_id
    where assignment.seat_id is not null
      and (
        invitee.attendance_status <> 'confirmed'
        or not invitee.requires_seat
        or not seat.is_active
        or not seating_table.is_active
      )

    union all

    select jsonb_build_object(
      'code', 'conflicting_seat_assignments',
      'message', 'A seat has more than one assignment.',
      'relatedIds', jsonb_build_array(assignment.seat_id)
    )
    from public.seating_assignments assignment
    where assignment.seat_id is not null
    group by assignment.seat_id
    having count(*) > 1

    union all

    select jsonb_build_object(
      'code', 'table_over_capacity',
      'message', format('%s is over capacity by %s.', seating_table.name, count(*) - seating_table.capacity),
      'relatedIds', jsonb_build_array(seating_table.id)
    )
    from public.seating_assignments assignment
    join public.seating_seats seat on seat.id = assignment.seat_id and seat.is_active
    join public.seating_tables seating_table on seating_table.id = seat.table_id and seating_table.is_active
    where assignment.seat_id is not null
    group by seating_table.id, seating_table.name, seating_table.capacity
    having count(*) > seating_table.capacity
  ) problems;

  select coalesce(jsonb_agg(issue), '[]'::jsonb)
    into warnings
  from (
    select jsonb_build_object(
      'code', 'split_invitation_party',
      'message', format('%s is split across %s tables.', invite.guest_name, count(distinct seat.table_id)),
      'relatedIds', jsonb_agg(invitee.id)
    ) as issue
    from public.invites invite
    join public.seating_invitees invitee on invitee.invite_code = invite.code
      and invitee.attendance_status = 'confirmed'
    join public.seating_assignments assignment
      on assignment.invitee_id = invitee.id
     and assignment.seat_id is not null
    join public.seating_seats seat on seat.id = assignment.seat_id and seat.is_active
    join public.seating_tables seating_table on seating_table.id = seat.table_id and seating_table.is_active
    group by invite.code, invite.guest_name
    having count(distinct seat.table_id) > 1

    union all

    select jsonb_build_object(
      'code', 'keep_together_split',
      'message', format('Keep-together group %s is split across %s tables.', grouping.name, count(distinct seat.table_id)),
      'relatedIds', jsonb_agg(invitee.id)
    )
    from public.seating_keep_together_groups grouping
    join public.seating_invitees invitee on invitee.keep_together_group_id = grouping.id
      and invitee.attendance_status = 'confirmed'
    join public.seating_assignments assignment
      on assignment.invitee_id = invitee.id
     and assignment.seat_id is not null
    join public.seating_seats seat on seat.id = assignment.seat_id and seat.is_active
    join public.seating_tables seating_table on seating_table.id = seat.table_id and seating_table.is_active
    group by grouping.id, grouping.name
    having count(distinct seat.table_id) > 1
  ) concerns;

  return jsonb_build_object(
    'canPublish', jsonb_array_length(errors) = 0,
    'errors', errors,
    'warnings', warnings
  );
end;
$$;

create function public.admin_upsert_seating_invitee(
  p_expected_version bigint,
  p_invitee jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_id uuid := public.require_seating_admin();
  v_invitee_id uuid := nullif(p_invitee ->> 'id', '')::uuid;
  v_invite_code text;
  v_tags_value text[];
  previous_seat_id uuid;
begin
  perform public.lock_seating_draft(p_expected_version);
  v_invite_code := public.resolve_seating_invite_code(p_invitee ->> 'invitationPartyId');
  if v_invite_code is null then
    raise exception 'INVITATION_NOT_FOUND' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(value), '{}')
    into v_tags_value
  from jsonb_array_elements_text(coalesce(p_invitee -> 'tags', '[]'::jsonb));

  if v_invitee_id is null then
    insert into public.seating_invitees (
      invite_code,
      full_name,
      attendance_status,
      requires_seat,
      tags,
      keep_together_group_id,
      private_notes,
      created_by,
      updated_by
    ) values (
      v_invite_code,
      trim(p_invitee ->> 'fullName'),
      coalesce(p_invitee ->> 'attendanceStatus', 'not_attending'),
      coalesce((p_invitee ->> 'requiresSeat')::boolean, true),
      v_tags_value,
      nullif(p_invitee ->> 'keepTogetherGroupId', '')::uuid,
      coalesce(p_invitee ->> 'privateNotes', ''),
      admin_id,
      admin_id
    ) returning id into v_invitee_id;
  else
    select seat_id into previous_seat_id
    from public.seating_assignments where invitee_id = v_invitee_id;
    update public.seating_invitees invitee
    set invite_code = v_invite_code,
        full_name = trim(p_invitee ->> 'fullName'),
        attendance_status = coalesce(p_invitee ->> 'attendanceStatus', invitee.attendance_status),
        requires_seat = coalesce((p_invitee ->> 'requiresSeat')::boolean, invitee.requires_seat),
        tags = v_tags_value,
        keep_together_group_id = nullif(p_invitee ->> 'keepTogetherGroupId', '')::uuid,
        private_notes = coalesce(p_invitee ->> 'privateNotes', ''),
        updated_by = admin_id,
        updated_at = now()
    where invitee.id = v_invitee_id;
    if not found then raise exception 'INVITEE_NOT_FOUND' using errcode = 'P0001'; end if;
  end if;

  update public.seating_assignments assignment
  set seat_id = null,
      assigned_by = admin_id,
      assigned_at = now()
  from public.seating_invitees invitee
  where assignment.invitee_id = invitee.id
    and invitee.id = v_invitee_id
    and assignment.seat_id is not null
    and (invitee.attendance_status <> 'confirmed' or not invitee.requires_seat);

  update public.seating_plan_state
  set draft_version = draft_version + 1, updated_by = admin_id, updated_at = now()
  where singleton;

  insert into public.seating_audit_log (kind, actor_id, draft_version, invitee_id, from_seat_id)
  select 'invitee_updated', admin_id, draft_version, v_invitee_id, previous_seat_id
  from public.seating_plan_state where singleton;

  return public.admin_get_seating_workspace();
end;
$$;

create function public.admin_resolve_attendance_roster(
  p_expected_version bigint,
  p_invite_code text,
  p_confirmed_invitee_ids uuid[],
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_id uuid := public.require_seating_admin();
  canonical_invite_code text;
  expected_count integer;
  previous_ids uuid[];
  previous_assignments jsonb;
  was_resolved boolean;
begin
  perform public.lock_seating_draft(p_expected_version);
  canonical_invite_code := public.resolve_seating_invite_code(p_invite_code);
  if canonical_invite_code is null then
    raise exception 'INVITATION_NOT_FOUND' using errcode = 'P0001';
  end if;

  select case
      when lower(coalesce(rsvp_status, '')) in ('yes', 'accepted') then coalesce(attendees_confirmed, 0)
      else 0
    end
    into expected_count
  from public.invites
  where code = canonical_invite_code;

  if cardinality(coalesce(p_confirmed_invitee_ids, '{}')) <> expected_count then
    raise exception 'ATTENDANCE_COUNT_MISMATCH:%', expected_count using errcode = 'P0001';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_confirmed_invitee_ids, '{}')) id
    where not exists (
      select 1 from public.seating_invitees invitee
      where invitee.id = id and invitee.invite_code = canonical_invite_code
    )
  ) then
    raise exception 'INVITEE_NOT_IN_PARTY' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(id order by id), '{}')
    into previous_ids
  from public.seating_invitees
  where invite_code = canonical_invite_code and attendance_status = 'confirmed';

  select exists (
    select 1 from public.seating_invitation_rosters where invite_code = canonical_invite_code
  ) into was_resolved;

  if was_resolved and previous_ids is distinct from (
    select coalesce(array_agg(id order by id), '{}')
    from unnest(coalesce(p_confirmed_invitee_ids, '{}')) id
  ) then
    if length(trim(coalesce(p_reason, ''))) = 0 then
      raise exception 'ROSTER_CHANGE_REASON_REQUIRED' using errcode = 'P0001';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
        'inviteeId', invitee.id,
        'seatId', assignment.seat_id
      )), '[]'::jsonb)
      into previous_assignments
    from public.seating_invitees invitee
    join public.seating_assignments assignment
      on assignment.invitee_id = invitee.id
     and assignment.seat_id is not null
    where invitee.invite_code = canonical_invite_code;

    insert into public.seating_attendance_roster_changes (
      invite_code,
      previous_invitee_ids,
      next_invitee_ids,
      previous_assignments,
      reason,
      changed_by
    ) values (
      canonical_invite_code,
      previous_ids,
      p_confirmed_invitee_ids,
      previous_assignments,
      trim(p_reason),
      admin_id
    );
  end if;

  update public.seating_invitees
  set attendance_status = case when id = any(coalesce(p_confirmed_invitee_ids, '{}'))
      then 'confirmed' else 'not_attending' end,
      updated_by = admin_id,
      updated_at = now()
  where invite_code = canonical_invite_code;

  update public.seating_assignments assignment
  set seat_id = null,
      assigned_by = admin_id,
      assigned_at = now()
  from public.seating_invitees invitee
  where assignment.invitee_id = invitee.id
    and invitee.invite_code = canonical_invite_code
    and assignment.seat_id is not null
    and (invitee.attendance_status <> 'confirmed' or not invitee.requires_seat);

  insert into public.seating_invitation_rosters (invite_code, resolved_by, resolved_at)
  values (canonical_invite_code, admin_id, now())
  on conflict (invite_code) do update
    set resolved_by = excluded.resolved_by, resolved_at = excluded.resolved_at;

  update public.seating_plan_state
  set draft_version = draft_version + 1, updated_by = admin_id, updated_at = now()
  where singleton;

  return public.admin_get_seating_workspace();
end;
$$;

create function public.admin_amend_seating_rsvp(
  p_expected_version bigint,
  p_invite_code text,
  p_next_status text,
  p_next_attending_count integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_id uuid := public.require_seating_admin();
  canonical_invite_code text;
  previous_status text;
  previous_count integer;
  maximum_count integer;
  next_version bigint;
  previous_assignments jsonb;
begin
  perform public.lock_seating_draft(p_expected_version);
  canonical_invite_code := public.resolve_seating_invite_code(p_invite_code);
  if canonical_invite_code is null then
    raise exception 'INVITATION_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_next_status not in ('accepted', 'declined') then
    raise exception 'INVALID_RSVP_STATUS' using errcode = 'P0001';
  end if;
  if (p_next_status = 'accepted' and p_next_attending_count < 1) or
     (p_next_status = 'declined' and p_next_attending_count <> 0) then
    raise exception 'INVALID_ATTENDING_COUNT' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'RSVP_AMENDMENT_REASON_REQUIRED' using errcode = 'P0001';
  end if;

  select rsvp_status, coalesce(attendees_confirmed, 0), max_seats
    into previous_status, previous_count, maximum_count
  from public.invites
  where code = canonical_invite_code
  for update;
  if p_next_attending_count > maximum_count then
    raise exception 'ATTENDING_COUNT_EXCEEDS_INVITATION_MAXIMUM:%', maximum_count using errcode = 'P0001';
  end if;
  if lower(coalesce(previous_status, '')) in (
      case when p_next_status = 'accepted' then 'yes' else 'no' end,
      p_next_status
    ) and previous_count = p_next_attending_count then
    raise exception 'RSVP_AMENDMENT_HAS_NO_CHANGE' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'inviteeId', invitee.id,
      'seatId', assignment.seat_id
    )), '[]'::jsonb)
    into previous_assignments
  from public.seating_invitees invitee
  join public.seating_assignments assignment
    on assignment.invitee_id = invitee.id
   and assignment.seat_id is not null
  where invitee.invite_code = canonical_invite_code;

  insert into public.seating_rsvp_amendments (
    invite_code,
    previous_status,
    previous_attending_count,
    next_status,
    next_attending_count,
    reason,
    amended_by
  ) values (
    canonical_invite_code,
    previous_status,
    previous_count,
    p_next_status,
    p_next_attending_count,
    trim(p_reason),
    admin_id
  );

  update public.invites
  set rsvp_status = case when p_next_status = 'accepted' then 'Yes' else 'No' end,
      attendees_confirmed = p_next_attending_count,
      updated_at = now()
  where code = canonical_invite_code;

  if p_next_status = 'declined' then
    update public.seating_assignments assignment
    set seat_id = null,
        assigned_by = admin_id,
        assigned_at = now()
    from public.seating_invitees invitee
    where assignment.invitee_id = invitee.id
      and invitee.invite_code = canonical_invite_code
      and assignment.seat_id is not null;
    update public.seating_invitees
    set attendance_status = 'not_attending', updated_by = admin_id, updated_at = now()
    where invite_code = canonical_invite_code;
  end if;

  update public.seating_plan_state
  set draft_version = draft_version + 1, updated_by = admin_id, updated_at = now()
  where singleton returning draft_version into next_version;
  insert into public.seating_audit_log (kind, actor_id, draft_version, details)
  values (
    'rsvp_amended',
    admin_id,
    next_version,
    jsonb_build_object(
      'inviteCode', canonical_invite_code,
      'previousStatus', previous_status,
      'previousAttendingCount', previous_count,
      'nextStatus', p_next_status,
      'nextAttendingCount', p_next_attending_count,
      'reason', trim(p_reason),
      'previousAssignments', previous_assignments
    )
  );

  return public.admin_get_seating_workspace();
end;
$$;

create function public.admin_upsert_seating_table(
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
  if next_capacity not between 1 and 30 then
    raise exception 'INVALID_TABLE_CAPACITY' using errcode = 'P0001';
  end if;

  if v_table_id is null then
    insert into public.seating_tables (name, table_number, shape, capacity, seat_one_angle)
    values (
      trim(p_table ->> 'name'),
      (p_table ->> 'number')::integer,
      p_table ->> 'shape',
      next_capacity,
      coalesce((p_table ->> 'seatOneAngle')::integer, 0)
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

create function public.admin_move_seating_invitee(
  p_expected_version bigint,
  p_invitee_id uuid,
  p_to_seat_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_id uuid := public.require_seating_admin();
  invitee_name text;
  eligible boolean;
  v_from_seat_id uuid;
  next_version bigint;
  current_version bigint;
  occupied_by text;
begin
  select draft_version into current_version
  from public.seating_plan_state where singleton for update;
  if current_version <> p_expected_version then
    if p_to_seat_id is not null then
      select administrator.display_name into occupied_by
      from public.seating_assignments assignment
      join public.seating_admins administrator on administrator.user_id = assignment.assigned_by
      where assignment.seat_id = p_to_seat_id
        and assignment.invitee_id <> p_invitee_id;
    end if;
    if occupied_by is not null then
      raise exception 'SEAT_OCCUPIED:%', occupied_by using errcode = '23505';
    end if;
    raise exception 'STALE_VERSION:%', current_version using errcode = 'P0001';
  end if;
  select full_name, attendance_status = 'confirmed' and requires_seat
    into invitee_name, eligible
  from public.seating_invitees where id = p_invitee_id for update;
  if not found then raise exception 'INVITEE_NOT_FOUND' using errcode = 'P0001'; end if;
  if not eligible then raise exception 'INVITEE_NOT_ELIGIBLE:%', invitee_name using errcode = 'P0001'; end if;

  select seat_id into v_from_seat_id
  from public.seating_assignments where invitee_id = p_invitee_id for update;

  if p_to_seat_id is not null then
    perform 1
    from public.seating_seats seat
    join public.seating_tables seating_table
      on seating_table.id = seat.table_id
     and seating_table.is_active
    where seat.id = p_to_seat_id
      and seat.is_active
    for update of seat;
    if not found then raise exception 'SEAT_NOT_FOUND' using errcode = 'P0001'; end if;
    select administrator.display_name into occupied_by
    from public.seating_assignments assignment
    join public.seating_admins administrator on administrator.user_id = assignment.assigned_by
    where assignment.seat_id = p_to_seat_id
      and assignment.invitee_id <> p_invitee_id;
    if occupied_by is not null then
      raise exception 'SEAT_OCCUPIED:%', occupied_by using errcode = '23505';
    end if;
  end if;

  if v_from_seat_id is not distinct from p_to_seat_id then
    return public.admin_get_seating_workspace();
  end if;

  insert into public.seating_assignments (invitee_id, seat_id, assigned_by, assigned_at)
  values (p_invitee_id, p_to_seat_id, admin_id, now())
  on conflict (invitee_id) do update
    set seat_id = excluded.seat_id,
        assigned_by = excluded.assigned_by,
        assigned_at = excluded.assigned_at;

  update public.seating_plan_state
  set draft_version = draft_version + 1, updated_by = admin_id, updated_at = now()
  where singleton returning draft_version into next_version;
  insert into public.seating_audit_log (
    kind, actor_id, draft_version, invitee_id, from_seat_id, to_seat_id
  ) values (
    'seat_moved', admin_id, next_version, p_invitee_id, v_from_seat_id, p_to_seat_id
  );

  return public.admin_get_seating_workspace();
end;
$$;

create function public.admin_undo_seating_move(
  p_expected_version bigint,
  p_audit_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_id uuid := public.require_seating_admin();
  original public.seating_audit_log%rowtype;
  current_seat_id uuid;
  next_version bigint;
begin
  perform public.lock_seating_draft(p_expected_version);
  select * into original from public.seating_audit_log
  where id = p_audit_id and kind = 'seat_moved';
  if not found then raise exception 'AUDIT_NOT_FOUND' using errcode = 'P0001'; end if;
  if exists (select 1 from public.seating_audit_log where reverses_audit_id = p_audit_id) then
    raise exception 'MOVE_ALREADY_UNDONE' using errcode = 'P0001';
  end if;

  select seat_id into current_seat_id
  from public.seating_assignments where invitee_id = original.invitee_id for update;
  if current_seat_id is distinct from original.to_seat_id then
    raise exception 'UNDO_CONFLICT' using errcode = 'P0001';
  end if;
  if original.from_seat_id is not null and exists (
    select 1 from public.seating_assignments
    where seat_id = original.from_seat_id and invitee_id <> original.invitee_id
  ) then
    raise exception 'UNDO_CONFLICT' using errcode = 'P0001';
  end if;
  if original.from_seat_id is not null and not exists (
    select 1
    from public.seating_seats seat
    join public.seating_tables seating_table
      on seating_table.id = seat.table_id
     and seating_table.is_active
    where seat.id = original.from_seat_id
      and seat.is_active
  ) then
    raise exception 'UNDO_CONFLICT' using errcode = 'P0001';
  end if;

  insert into public.seating_assignments (invitee_id, seat_id, assigned_by, assigned_at)
  values (original.invitee_id, original.from_seat_id, admin_id, now())
  on conflict (invitee_id) do update
    set seat_id = excluded.seat_id,
        assigned_by = excluded.assigned_by,
        assigned_at = excluded.assigned_at;

  update public.seating_plan_state
  set draft_version = draft_version + 1, updated_by = admin_id, updated_at = now()
  where singleton returning draft_version into next_version;
  insert into public.seating_audit_log (
    kind, actor_id, draft_version, invitee_id, from_seat_id, to_seat_id, reverses_audit_id
  ) values (
    'seat_move_undone', admin_id, next_version, original.invitee_id,
    original.to_seat_id, original.from_seat_id, original.id
  );

  return public.admin_get_seating_workspace();
end;
$$;

create function public.admin_publish_seating_plan(p_expected_version bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_id uuid := public.require_seating_admin();
  validation jsonb;
  snapshot jsonb;
  next_revision integer;
  revision_id uuid;
  next_version bigint;
begin
  perform public.lock_seating_draft(p_expected_version);
  validation := public.seating_publication_validation();
  if not (validation ->> 'canPublish')::boolean then
    raise exception 'PUBLICATION_BLOCKED:%', validation using errcode = 'P0001';
  end if;

  select coalesce(max(revision_number), 0) + 1 into next_revision
  from public.seating_plan_revisions;

  select jsonb_build_object(
    'invitationParties', workspace -> 'draft' -> 'invitationParties',
    'invitees', workspace -> 'draft' -> 'invitees',
    'tables', workspace -> 'draft' -> 'tables',
    'seats', workspace -> 'draft' -> 'seats',
    'assignments', workspace -> 'draft' -> 'assignments'
  ) into snapshot
  from (select public.admin_get_seating_workspace() workspace) source;

  insert into public.seating_plan_revisions (
    revision_number, snapshot, published_by, published_at
  ) values (
    next_revision, snapshot, admin_id, now()
  ) returning id into revision_id;

  update public.seating_plan_state
  set draft_version = draft_version + 1,
      published_revision_id = revision_id,
      updated_by = admin_id,
      updated_at = now()
  where singleton returning draft_version into next_version;
  insert into public.seating_audit_log (
    kind, actor_id, draft_version, revision_number
  ) values (
    'plan_published', admin_id, next_version, next_revision
  );

  return public.admin_get_seating_workspace();
end;
$$;

create function public.admin_restore_seating_revision(
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
    is_active,
    updated_at
  )
  select id, name, number, shape, capacity, "seatOneAngle", true, now()
  from jsonb_to_recordset(selected_revision.snapshot -> 'tables') as item(
    id uuid,
    name text,
    number integer,
    shape text,
    capacity integer,
    "seatOneAngle" integer
  )
  on conflict (id) do update
    set name = excluded.name,
        table_number = excluded.table_number,
        shape = excluded.shape,
        capacity = excluded.capacity,
        seat_one_angle = excluded.seat_one_angle,
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

create function public.admin_set_guest_seating_token(
  p_invite_code text,
  p_plain_token text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_id uuid := public.require_seating_admin();
  canonical_invite_code text;
begin
  if length(p_plain_token) < 32 then
    raise exception 'SEATING_TOKEN_TOO_SHORT' using errcode = 'P0001';
  end if;
  canonical_invite_code := public.resolve_seating_invite_code(p_invite_code);
  if canonical_invite_code is null then
    raise exception 'INVITATION_NOT_FOUND' using errcode = 'P0001';
  end if;
  insert into public.seating_guest_tokens (invite_code, token_hash, created_by)
  values (canonical_invite_code, extensions.digest(p_plain_token, 'sha256'), admin_id)
  on conflict (invite_code) do update
    set token_hash = excluded.token_hash, created_by = excluded.created_by, created_at = now();
end;
$$;

create function public.admin_set_guest_lookup_enabled(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_id uuid := public.require_seating_admin();
  next_version bigint;
begin
  update public.seating_plan_state
  set guest_lookup_enabled = p_enabled, updated_by = admin_id, updated_at = now()
  where singleton returning draft_version into next_version;
  insert into public.seating_audit_log (kind, actor_id, draft_version, details)
  values ('guest_lookup_changed', admin_id, next_version, jsonb_build_object('enabled', p_enabled));
  return public.admin_get_seating_workspace();
end;
$$;

create function public.get_published_seating_for_invite(
  p_code text,
  p_seating_token text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  canonical_invite_code text;
  snapshot jsonb;
  revision_number integer;
  token_hash bytea;
begin
  canonical_invite_code := public.resolve_seating_invite_code(p_code);
  if canonical_invite_code is null then
    return null;
  end if;
  if not (select guest_lookup_enabled from public.seating_plan_state where singleton) then
    return null;
  end if;

  select guest_token.token_hash into token_hash
  from public.seating_guest_tokens guest_token
  where guest_token.invite_code = canonical_invite_code;
  if not found or p_seating_token is null or
    extensions.digest(p_seating_token, 'sha256') <> token_hash then
    return null;
  end if;

  select revision.snapshot, revision.revision_number
    into snapshot, revision_number
  from public.seating_plan_state state
  join public.seating_plan_revisions revision on revision.id = state.published_revision_id
  where state.singleton;
  if snapshot is null then return null; end if;

  return jsonb_build_object(
    'revisionNumber', revision_number,
    'party', coalesce((
      select item
      from jsonb_array_elements(snapshot -> 'invitationParties') item
      where item ->> 'id' = canonical_invite_code
      limit 1
    ), '{}'::jsonb),
    'invitees', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', item ->> 'id',
        'fullName', item ->> 'fullName',
        'requiresSeat', (item ->> 'requiresSeat')::boolean
      ))
      from jsonb_array_elements(snapshot -> 'invitees') item
      where item ->> 'invitationPartyId' = canonical_invite_code
        and item ->> 'attendanceStatus' = 'confirmed'
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(assignment)
      from jsonb_array_elements(snapshot -> 'assignments') assignment
      where assignment ->> 'inviteeId' in (
        select invitee ->> 'id'
        from jsonb_array_elements(snapshot -> 'invitees') invitee
        where invitee ->> 'invitationPartyId' = canonical_invite_code
      )
    ), '[]'::jsonb),
    'tables', snapshot -> 'tables',
    'seats', snapshot -> 'seats'
  );
end;
$$;

revoke all on function public.require_seating_admin() from public;
revoke all on function public.lock_seating_draft(bigint) from public;
revoke all on function public.resolve_seating_invite_code(text) from public;
revoke all on function public.admin_get_seating_workspace() from public;
revoke all on function public.seating_publication_validation() from public;
revoke all on function public.admin_upsert_seating_invitee(bigint, jsonb) from public;
revoke all on function public.admin_resolve_attendance_roster(bigint, text, uuid[], text) from public;
revoke all on function public.admin_amend_seating_rsvp(bigint, text, text, integer, text) from public;
revoke all on function public.admin_upsert_seating_table(bigint, jsonb) from public;
revoke all on function public.admin_move_seating_invitee(bigint, uuid, uuid) from public;
revoke all on function public.admin_undo_seating_move(bigint, uuid) from public;
revoke all on function public.admin_publish_seating_plan(bigint) from public;
revoke all on function public.admin_restore_seating_revision(bigint, uuid) from public;
revoke all on function public.admin_set_guest_seating_token(text, text) from public;
revoke all on function public.admin_set_guest_lookup_enabled(boolean) from public;
revoke all on function public.get_published_seating_for_invite(text, text) from public;

grant execute on function public.admin_get_seating_workspace() to authenticated;
grant execute on function public.seating_publication_validation() to authenticated;
grant execute on function public.admin_upsert_seating_invitee(bigint, jsonb) to authenticated;
grant execute on function public.admin_resolve_attendance_roster(bigint, text, uuid[], text) to authenticated;
grant execute on function public.admin_amend_seating_rsvp(bigint, text, text, integer, text) to authenticated;
grant execute on function public.admin_upsert_seating_table(bigint, jsonb) to authenticated;
grant execute on function public.admin_move_seating_invitee(bigint, uuid, uuid) to authenticated;
grant execute on function public.admin_undo_seating_move(bigint, uuid) to authenticated;
grant execute on function public.admin_publish_seating_plan(bigint) to authenticated;
grant execute on function public.admin_restore_seating_revision(bigint, uuid) to authenticated;
grant execute on function public.admin_set_guest_seating_token(text, text) to authenticated;
grant execute on function public.admin_set_guest_lookup_enabled(boolean) to authenticated;
grant execute on function public.get_published_seating_for_invite(text, text) to anon, authenticated;

alter publication supabase_realtime add table public.seating_plan_state;
alter publication supabase_realtime add table public.seating_assignments;
