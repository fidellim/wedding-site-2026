-- Allow invited guests to explore names and tables in the released plan.
-- Chair numbers are shared only after physical chair positions are approved.
create or replace function public.get_seating_guide_for_invite(p_code text)
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
    'directory', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'fullName', person ->> 'fullName', 'tableId', seat ->> 'tableId',
      'seatNumber', case when chairs_approved then (seat ->> 'number')::integer end))
      order by seat ->> 'tableId', (seat ->> 'number')::integer)
      from jsonb_array_elements(snapshot -> 'assignments') assignment
      join jsonb_array_elements(snapshot -> 'invitees') person on person ->> 'id' = assignment ->> 'inviteeId'
      join jsonb_array_elements(snapshot -> 'seats') seat on seat ->> 'id' = assignment ->> 'seatId'
      where person ->> 'attendanceStatus' = 'confirmed'), '[]'::jsonb),
    'tables', coalesce((select jsonb_agg(item)
      from jsonb_array_elements(snapshot -> 'tables') item), '[]'::jsonb),
    'seats', snapshot -> 'seats', 'venueLayout', snapshot -> 'venueLayout'
  );
end;
$$;

revoke all on function public.get_seating_guide_for_invite(text) from public;
grant execute on function public.get_seating_guide_for_invite(text) to anon, authenticated;
