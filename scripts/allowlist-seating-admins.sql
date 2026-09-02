-- Replace only the two email placeholders below, then run the whole file in
-- Supabase SQL Editor. This adds no guest data and deletes no records.

begin;

do $seating_admin_allowlist$
declare
  hannah_email constant text := lower(trim('hannahjileennn@gmail.com'));
  fidel_email constant text := lower(trim('lim.fidel@gmail.com'));
  matching_users integer;
  confirmed_users integer;
  active_admins integer;
begin
  if hannah_email in ('', '<hannah_email>')
    or fidel_email in ('', '<fidel_email>') then
    raise exception 'Replace both administrator email placeholders before running';
  end if;

  if hannah_email = fidel_email then
    raise exception 'Administrator email addresses must be different';
  end if;

  select count(*)
    into matching_users
  from auth.users
  where lower(email) in (hannah_email, fidel_email);

  if matching_users <> 2 then
    raise exception 'Expected two matching Auth users, found %', matching_users;
  end if;

  select count(*)
    into confirmed_users
  from auth.users
  where lower(email) in (hannah_email, fidel_email)
    and email_confirmed_at is not null;

  if confirmed_users <> 2 then
    raise exception 'Both administrator emails must be confirmed before allowlisting';
  end if;

  insert into public.seating_admins (user_id, email, display_name)
  select
    id,
    lower(email),
    case lower(email)
      when hannah_email then 'Hannah'
      when fidel_email then 'Fidel'
    end
  from auth.users
  where lower(email) in (hannah_email, fidel_email)
  on conflict do nothing;

  select count(*)
    into active_admins
  from public.seating_admins
  where is_active;

  if active_admins <> 2 or exists (
    select 1
    from public.seating_admins
    where is_active
      and lower(email) not in (hannah_email, fidel_email)
  ) then
    raise exception 'Active seating administrator allowlist is not exactly Hannah and Fidel';
  end if;
end
$seating_admin_allowlist$;

commit;

select jsonb_pretty(jsonb_build_object(
  'result', 'Seating administrators allowlisted successfully',
  'activeAdministratorCount', count(*),
  'administrators', jsonb_agg(jsonb_build_object(
    'displayName', display_name,
    'email', email
  ) order by display_name)
)) as seating_admin_allowlist_result
from public.seating_admins
where is_active;
