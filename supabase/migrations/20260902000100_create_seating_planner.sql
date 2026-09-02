-- Local source migration only. The production public schema was inspected on
-- 2026-09-02. Validate this migration in a rollback-only transaction before
-- applying it; it must not alter existing tables, functions, policies, or data.

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  required_column text;
begin
  if to_regclass('public.invites') is null then
    raise exception 'Expected public.invites to exist before seating migration';
  end if;

  foreach required_column in array array[
    'code',
    'guest_name',
    'max_seats',
    'rsvp_status',
    'attendees_confirmed',
    'updated_at'
  ]
  loop
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'invites'
        and column_name = required_column
    ) then
      raise exception 'Expected public.invites.% to exist before seating migration', required_column;
    end if;
  end loop;

  if exists (
    select 1 from public.invites where length(trim(code)) = 0
  ) then
    raise exception 'Expected public.invites.code to contain no blank values';
  end if;

  if exists (
    select 1
    from public.invites
    group by lower(trim(code))
    having count(*) > 1
  ) then
    raise exception 'Expected public.invites.code to be unique when compared case-insensitively';
  end if;
end
$$;

create table public.seating_admins (
  user_id uuid primary key references auth.users(id) on delete restrict,
  email text not null unique,
  display_name text not null check (length(trim(display_name)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.seating_keep_together_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_by uuid not null references public.seating_admins(user_id),
  created_at timestamptz not null default now()
);

create table public.seating_invitees (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null references public.invites(code) on update cascade on delete restrict,
  full_name text not null check (length(trim(full_name)) > 0),
  attendance_status text not null default 'not_attending'
    check (attendance_status in ('confirmed', 'not_attending')),
  requires_seat boolean not null default true,
  tags text[] not null default '{}',
  keep_together_group_id uuid references public.seating_keep_together_groups(id) on delete restrict,
  private_notes text not null default '',
  created_by uuid not null references public.seating_admins(user_id),
  updated_by uuid not null references public.seating_admins(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index seating_invitees_party_name_unique
  on public.seating_invitees (invite_code, lower(full_name));
create index seating_invitees_invite_code_idx
  on public.seating_invitees (invite_code);

create table public.seating_invitation_rosters (
  invite_code text primary key references public.invites(code) on update cascade on delete restrict,
  resolved_by uuid not null references public.seating_admins(user_id),
  resolved_at timestamptz not null default now()
);

create table public.seating_attendance_roster_changes (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null references public.invites(code) on update cascade on delete restrict,
  previous_invitee_ids uuid[] not null,
  next_invitee_ids uuid[] not null,
  previous_assignments jsonb not null default '[]',
  reason text not null check (length(trim(reason)) > 0),
  changed_by uuid not null references public.seating_admins(user_id),
  changed_at timestamptz not null default now()
);

create table public.seating_rsvp_amendments (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null references public.invites(code) on update cascade on delete restrict,
  previous_status text,
  previous_attending_count integer,
  next_status text not null,
  next_attending_count integer not null check (next_attending_count >= 0),
  reason text not null check (length(trim(reason)) > 0),
  amended_by uuid not null references public.seating_admins(user_id),
  amended_at timestamptz not null default now()
);

create table public.seating_tables (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  table_number integer not null check (table_number > 0),
  shape text not null check (shape in ('round', 'rectangular')),
  capacity integer not null check (capacity between 1 and 30),
  seat_one_angle integer not null default 0 check (seat_one_angle between 0 and 359),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index seating_tables_active_number_unique
  on public.seating_tables (table_number)
  where is_active;

create table public.seating_seats (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.seating_tables(id) on delete restrict,
  seat_number integer not null check (seat_number > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (table_id, seat_number)
);

create table public.seating_assignments (
  invitee_id uuid primary key references public.seating_invitees(id) on delete restrict,
  seat_id uuid references public.seating_seats(id) on delete restrict,
  assigned_by uuid not null references public.seating_admins(user_id),
  assigned_at timestamptz not null default now()
);

create unique index seating_assignments_occupied_seat_unique
  on public.seating_assignments (seat_id)
  where seat_id is not null;

create table public.seating_plan_revisions (
  id uuid primary key default gen_random_uuid(),
  revision_number integer not null unique check (revision_number > 0),
  snapshot jsonb not null,
  published_by uuid not null references public.seating_admins(user_id),
  published_at timestamptz not null default now()
);

create table public.seating_plan_state (
  singleton boolean primary key default true check (singleton),
  draft_version bigint not null default 1 check (draft_version > 0),
  published_revision_id uuid references public.seating_plan_revisions(id),
  guest_lookup_enabled boolean not null default true,
  updated_by uuid references public.seating_admins(user_id),
  updated_at timestamptz not null default now()
);

insert into public.seating_plan_state (singleton) values (true);

create table public.seating_guest_tokens (
  invite_code text primary key references public.invites(code) on update cascade on delete restrict,
  token_hash bytea not null,
  created_by uuid not null references public.seating_admins(user_id),
  created_at timestamptz not null default now()
);

create table public.seating_audit_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (
    kind in (
      'seat_moved',
      'seat_move_undone',
      'plan_published',
      'revision_restored',
      'invitee_updated',
      'table_updated',
      'rsvp_amended',
      'guest_lookup_changed'
    )
  ),
  actor_id uuid not null references public.seating_admins(user_id),
  occurred_at timestamptz not null default now(),
  draft_version bigint not null,
  invitee_id uuid references public.seating_invitees(id) on delete restrict,
  from_seat_id uuid references public.seating_seats(id) on delete restrict,
  to_seat_id uuid references public.seating_seats(id) on delete restrict,
  revision_number integer,
  reverses_audit_id uuid references public.seating_audit_log(id) on delete restrict,
  details jsonb not null default '{}'
);

create index seating_audit_log_occurred_at_idx
  on public.seating_audit_log (occurred_at desc);

alter table public.seating_admins enable row level security;
alter table public.seating_keep_together_groups enable row level security;
alter table public.seating_invitees enable row level security;
alter table public.seating_invitation_rosters enable row level security;
alter table public.seating_attendance_roster_changes enable row level security;
alter table public.seating_rsvp_amendments enable row level security;
alter table public.seating_tables enable row level security;
alter table public.seating_seats enable row level security;
alter table public.seating_assignments enable row level security;
alter table public.seating_plan_revisions enable row level security;
alter table public.seating_plan_state enable row level security;
alter table public.seating_guest_tokens enable row level security;
alter table public.seating_audit_log enable row level security;

create function public.is_seating_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.seating_admins
    where user_id = auth.uid()
      and is_active
  );
$$;

revoke all on function public.is_seating_admin() from public;
grant execute on function public.is_seating_admin() to authenticated;

create policy "active admins read their profile"
  on public.seating_admins for select to authenticated
  using (public.is_seating_admin());

create policy "active admins read keep-together groups"
  on public.seating_keep_together_groups for select to authenticated
  using (public.is_seating_admin());
create policy "active admins read invitees"
  on public.seating_invitees for select to authenticated
  using (public.is_seating_admin());
create policy "active admins read invitation rosters"
  on public.seating_invitation_rosters for select to authenticated
  using (public.is_seating_admin());
create policy "active admins read roster history"
  on public.seating_attendance_roster_changes for select to authenticated
  using (public.is_seating_admin());
create policy "active admins read rsvp amendments"
  on public.seating_rsvp_amendments for select to authenticated
  using (public.is_seating_admin());
create policy "active admins read tables"
  on public.seating_tables for select to authenticated
  using (public.is_seating_admin());
create policy "active admins read seats"
  on public.seating_seats for select to authenticated
  using (public.is_seating_admin());
create policy "active admins read assignments"
  on public.seating_assignments for select to authenticated
  using (public.is_seating_admin());
create policy "active admins read revisions"
  on public.seating_plan_revisions for select to authenticated
  using (public.is_seating_admin());
create policy "active admins read plan state"
  on public.seating_plan_state for select to authenticated
  using (public.is_seating_admin());
create policy "active admins read audit log"
  on public.seating_audit_log for select to authenticated
  using (public.is_seating_admin());

-- All writes flow through security-definer functions so the database can
-- enforce optimistic versions, audit history, and publication invariants.
revoke all on table public.seating_admins,
  public.seating_keep_together_groups,
  public.seating_invitees,
  public.seating_invitation_rosters,
  public.seating_attendance_roster_changes,
  public.seating_rsvp_amendments,
  public.seating_tables,
  public.seating_seats,
  public.seating_assignments,
  public.seating_plan_revisions,
  public.seating_plan_state,
  public.seating_guest_tokens,
  public.seating_audit_log
from anon, authenticated;
grant select on public.seating_admins,
  public.seating_keep_together_groups,
  public.seating_invitees,
  public.seating_invitation_rosters,
  public.seating_attendance_roster_changes,
  public.seating_rsvp_amendments,
  public.seating_tables,
  public.seating_seats,
  public.seating_assignments,
  public.seating_plan_revisions,
  public.seating_plan_state,
  public.seating_audit_log
to authenticated;
