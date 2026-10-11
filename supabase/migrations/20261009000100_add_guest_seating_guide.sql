-- A separate, initially closed release gate preserves existing guest access.
-- Publishing subsequent drafts does not silently replace a reviewed guest guide.
alter table public.seating_plan_state
  add column guide_revision_id uuid references public.seating_plan_revisions(id),
  add column guide_chairs_approved boolean not null default false;

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
    'guestLookupEnabled', state.guest_lookup_enabled,
    'guideRelease', jsonb_build_object('revisionId', state.guide_revision_id, 'chairsApproved', state.guide_chairs_approved)
  )
  into result
  from public.seating_plan_state state
  left join public.seating_plan_revisions revision
    on revision.id = state.published_revision_id
  where state.singleton;

  return result;
end;
$$;

create function public.admin_release_seating_guide(p_revision_id uuid, p_chairs_approved boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  admin_id uuid := public.require_seating_admin();
  current_revision uuid;
  snapshot jsonb;
begin
  select published_revision_id into current_revision from public.seating_plan_state where singleton for update;
  if p_revision_id is not null then
    if p_revision_id is distinct from current_revision then
      raise exception 'STALE_VERSION: Review the current published revision before releasing.' using errcode = 'P0001';
    end if;
    select revision.snapshot into snapshot from public.seating_plan_revisions revision where id = p_revision_id;
    if not coalesce(public.valid_seating_venue_layout(snapshot -> 'venueLayout'), false) then
      raise exception 'GUIDE_LAYOUT_REQUIRED: Publish a positioned venue layout first.' using errcode = 'P0001';
    end if;
  end if;
  update public.seating_plan_state set guide_revision_id = p_revision_id,
    guide_chairs_approved = p_revision_id is not null and coalesce(p_chairs_approved, false),
    updated_by = admin_id, updated_at = now() where singleton;
  insert into public.seating_audit_log(kind, actor_id, draft_version, details)
    select 'guest_lookup_changed', admin_id, draft_version,
      jsonb_build_object('guideRevisionId', p_revision_id, 'chairsApproved', guide_chairs_approved)
    from public.seating_plan_state where singleton;
  return public.admin_get_seating_workspace();
end;
$$;

-- The existing invitation code is the party's access credential, as for RSVP.
-- Never return other parties' identities, notes, tags or draft furniture.
create function public.get_seating_guide_for_invite(p_code text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  canonical_code text := public.resolve_seating_invite_code(p_code);
  snapshot jsonb;
  revision_number integer;
  chairs_approved boolean;
  party jsonb;
  people jsonb;
begin
  if canonical_code is null then return null; end if;
  select revision.snapshot, revision.revision_number, state.guide_chairs_approved
    into snapshot, revision_number, chairs_approved
    from public.seating_plan_state state
    join public.seating_plan_revisions revision on revision.id = state.guide_revision_id
    where state.singleton and state.guest_lookup_enabled;
  if snapshot is null then return null; end if;
  select item into party from jsonb_array_elements(snapshot -> 'invitationParties') item
    where item ->> 'id' = canonical_code and item ->> 'rsvpStatus' = 'accepted';
  if party is null then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', item ->> 'id',
    'fullName', item ->> 'fullName', 'requiresSeat', (item ->> 'requiresSeat')::boolean)), '[]'::jsonb)
    into people from jsonb_array_elements(snapshot -> 'invitees') item
    where item ->> 'invitationPartyId' = canonical_code and item ->> 'attendanceStatus' = 'confirmed';
  return jsonb_build_object(
    'revisionNumber', revision_number, 'chairsApproved', chairs_approved,
    'ceremonyChairs', (select count(*) from jsonb_array_elements(snapshot -> 'invitees') person
      where person ->> 'attendanceStatus' = 'confirmed' and (person ->> 'requiresSeat')::boolean),
    'party', party, 'invitees', people,
    'assignments', coalesce((select jsonb_agg(item) from jsonb_array_elements(snapshot -> 'assignments') item
      where item ->> 'inviteeId' in (select person ->> 'id' from jsonb_array_elements(people) person)), '[]'::jsonb),
    'tables', coalesce((select jsonb_agg(item || jsonb_build_object('name', 'Table ' || (item ->> 'number')))
      from jsonb_array_elements(snapshot -> 'tables') item), '[]'::jsonb),
    'seats', snapshot -> 'seats', 'venueLayout', snapshot -> 'venueLayout'
  );
end;
$$;

revoke all on function public.admin_release_seating_guide(uuid, boolean) from public;
revoke all on function public.get_seating_guide_for_invite(text) from public;
grant execute on function public.admin_release_seating_guide(uuid, boolean) to authenticated;
grant execute on function public.get_seating_guide_for_invite(text) to anon, authenticated;
