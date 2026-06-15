-- EventLink initial schema (run in Supabase SQL or via CLI migrate)
-- Aligns with: registry signup, role-based portals, multi-day events, equipment, audit history.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.app_role as enum (
  'student',
  'student_officer',
  'ssc',
  'adviser',
  'dean',
  'osas',
  'eo',
  'gso',
  'admin'
);

create type public.request_type as enum ('student_officer', 'ssc', 'eo_direct');

create type public.request_status as enum ('pending', 'declined', 'approved', 'posted');

create type public.workflow_step as enum (
  'adviser',
  'dean',
  'osas',
  'eo_schedule',
  'gso',
  'eo_publish'
);

-- ---------------------------------------------------------------------------
-- Core reference data
-- ---------------------------------------------------------------------------
create table public.colleges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  created_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges (id) on delete restrict,
  name text not null,
  slug text,
  created_at timestamptz not null default now(),
  unique (college_id, name)
);

/** Master student registry — signup must match student_id exactly (YY-XXXX). */
create table public.students (
  student_id text primary key,
  full_name text not null,
  course text not null default '',
  program text not null default '',
  year_level text not null default '',
  email text,
  college_id uuid references public.colleges (id) on delete set null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_id_format check (student_id ~ '^[0-9]{2}-[0-9]{4}$')
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  email text,
  phone text not null default '',
  student_id text references public.students (student_id) on delete set null,
  college_id uuid references public.colleges (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

/** One application role per account. */
create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null
);

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  quantity_available integer not null default 0 check (quantity_available >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Event requests
-- ---------------------------------------------------------------------------
create table public.event_requests (
  id uuid primary key default gen_random_uuid(),
  request_type public.request_type not null,
  status public.request_status not null default 'pending',
  current_step public.workflow_step,
  organization_id uuid references public.organizations (id) on delete restrict,
  submitted_by uuid not null references auth.users (id) on delete restrict,
  activity text not null,
  start_date date not null,
  end_date date not null,
  start_time time not null,
  end_time time not null,
  venue text not null,
  number_of_participants integer not null check (number_of_participants > 0),
  sdgs text not null default '',
  purpose text not null default '',
  needs_gso boolean not null default false,
  letter_path text,
  decline_reason text,
  declined_at_step public.workflow_step,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_requests_date_range check (end_date >= start_date)
);

create table public.event_request_equipment (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.event_requests (id) on delete cascade,
  equipment_id uuid not null references public.equipment (id) on delete restrict,
  quantity_requested integer not null check (quantity_requested > 0),
  unique (request_id, equipment_id)
);

create table public.event_request_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.event_requests (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  step public.workflow_step,
  comment text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

/** Anonymous feedback — no user_id stored. */
create table public.event_feedback (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.event_requests (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  improvement_tags text[] not null default '{}',
  comment text,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null default '',
  category text not null default 'system',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index event_requests_status_idx on public.event_requests (status);
create index event_requests_venue_dates_idx on public.event_requests (venue, start_date, end_date);
create index event_requests_submitted_by_idx on public.event_requests (submitted_by);
create index notifications_user_id_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.get_user_role(p_user_id uuid)
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_roles where user_id = p_user_id;
$$;

create or replace function public.has_role(p_user_id uuid, p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_user_id and ur.role = p_role
  );
$$;

/** Signup step 1 — exact ID match against registry (not archived). */
create or replace function public.verify_student_registry(p_student_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.students s
    where upper(trim(s.student_id)) = upper(trim(p_student_id))
      and not s.archived
  );
$$;

/** Same venue cannot overlap dates for pending/approved/posted requests. */
create or replace function public.check_venue_availability(
  p_venue text,
  p_start date,
  p_end date,
  p_exclude_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.event_requests r
    where lower(trim(r.venue)) = lower(trim(p_venue))
      and r.status in ('pending', 'approved', 'posted')
      and (p_exclude_id is null or r.id <> p_exclude_id)
      and daterange(r.start_date, r.end_date, '[]') && daterange(p_start, p_end, '[]')
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger students_updated_at
before update on public.students
for each row execute function public.set_updated_at();

create trigger equipment_updated_at
before update on public.equipment
for each row execute function public.set_updated_at();

create trigger event_requests_updated_at
before update on public.event_requests
for each row execute function public.set_updated_at();

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- New auth user → profile + default student role (staff accounts assigned separately).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sid text;
  sname text;
begin
  sid := upper(trim(coalesce(new.raw_user_meta_data ->> 'student_id', '')));
  sname := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );

  insert into public.profiles (id, display_name, email, student_id)
  values (
    new.id,
    sname,
    new.email,
    case when sid = '' then null else sid end
  );

  insert into public.user_roles (user_id, role)
  values (new.id, 'student')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_eventlink on auth.users;
create trigger on_auth_user_created_eventlink
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.colleges enable row level security;
alter table public.organizations enable row level security;
alter table public.students enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.equipment enable row level security;
alter table public.event_requests enable row level security;
alter table public.event_request_equipment enable row level security;
alter table public.event_request_history enable row level security;
alter table public.event_feedback enable row level security;
alter table public.notifications enable row level security;

-- Colleges / orgs: readable by signed-in users
create policy colleges_select_authenticated on public.colleges
  for select to authenticated using (true);

create policy organizations_select_authenticated on public.organizations
  for select to authenticated using (true);

create policy colleges_admin_write on public.colleges
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy organizations_admin_write on public.organizations
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Registry: admin manages; no public table scan
create policy students_admin_all on public.students
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Profiles
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Roles: read own
create policy user_roles_select_own on public.user_roles
  for select to authenticated using (user_id = auth.uid());

create policy user_roles_admin_all on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Equipment: GSO/admin manage; all authenticated read active
create policy equipment_select_authenticated on public.equipment
  for select to authenticated using (active or public.has_role(auth.uid(), 'gso') or public.has_role(auth.uid(), 'admin'));

create policy equipment_gso_admin_write on public.equipment
  for all to authenticated
  using (public.has_role(auth.uid(), 'gso') or public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'gso') or public.has_role(auth.uid(), 'admin'));

-- Event requests (broad read for authenticated portals — tighten per-step policies in a follow-up migration)
create policy event_requests_select_authenticated on public.event_requests
  for select to authenticated using (true);

create policy event_requests_insert_submitter on public.event_requests
  for insert to authenticated
  with check (
    submitted_by = auth.uid()
    and public.get_user_role(auth.uid()) in ('student_officer', 'ssc', 'eo')
  );

create policy event_requests_update_submitter_declined on public.event_requests
  for update to authenticated
  using (submitted_by = auth.uid() and status = 'declined')
  with check (submitted_by = auth.uid());

create policy event_requests_update_staff on public.event_requests
  for update to authenticated
  using (
    public.get_user_role(auth.uid()) in ('adviser', 'dean', 'osas', 'eo', 'gso', 'admin')
  );

create policy event_request_equipment_all_authenticated on public.event_request_equipment
  for all to authenticated using (true) with check (true);

create policy event_request_history_select_authenticated on public.event_request_history
  for select to authenticated using (true);

create policy event_request_history_insert_authenticated on public.event_request_history
  for insert to authenticated with check (true);

-- Posted events: students submit feedback after event end (enforced in app + optional RPC later)
create policy event_feedback_insert_authenticated on public.event_feedback
  for insert to authenticated with check (true);

create policy event_feedback_select_org on public.event_feedback
  for select to authenticated using (true);

-- Notifications
create policy notifications_own on public.notifications
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- RPC grants
/** Returns registry row for signup step 2 (no table scan for anon). */
create or replace function public.get_student_registry_row(p_student_id text)
returns table (
  student_id text,
  full_name text,
  email text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.student_id, s.full_name, s.email
  from public.students s
  where upper(trim(s.student_id)) = upper(trim(p_student_id))
    and not s.archived
  limit 1;
$$;

grant execute on function public.verify_student_registry(text) to anon, authenticated;
grant execute on function public.get_student_registry_row(text) to anon, authenticated;
grant execute on function public.check_venue_availability(text, date, date, uuid) to authenticated;
grant execute on function public.get_user_role(uuid) to authenticated;

-- Storage bucket (run once; adjust in Dashboard if name differs)
insert into storage.buckets (id, name, public)
values ('event-letters', 'event-letters', false)
on conflict (id) do nothing;
