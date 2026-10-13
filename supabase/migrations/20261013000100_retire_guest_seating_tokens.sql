-- Invitation codes are the sole guest credential. No token links were distributed.
-- Require the replacement endpoint and unambiguous codes before retiring access.
do $preflight$
begin
  if to_regprocedure('public.get_seating_guide_for_invite(text)') is null then
    raise exception 'Code-based Seating Guide must be installed first';
  end if;
  if exists (select 1 from public.invites where code is null or trim(code) = '') then
    raise exception 'Blank invitation codes must be resolved before retiring seating tokens';
  end if;
  if exists (
    select lower(trim(code)) from public.invites
    group by lower(trim(code)) having count(*) > 1
  ) then
    raise exception 'Duplicate normalized invitation codes must be resolved before retiring seating tokens';
  end if;
end
$preflight$;

-- Explicit removals only; never cascade into invitation or seating records.
drop function if exists public.admin_set_guest_seating_token(text, text);
drop function if exists public.get_published_seating_for_invite(text, text);
drop table if exists public.seating_guest_tokens;
