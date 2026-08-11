-- Phase 1b: Resource offices schema, policies, venue/equipment ownership.
-- IMPORTANT: Run 20260811000000_resource_offices_enums.sql FIRST in a separate
-- query (and let it commit). New enum values cannot be used in the same transaction.

-- ---------------------------------------------------------------------------
-- Resource office enums (new types — safe to create with all values at once)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.resource_office as enum (
    'gso',
    'it_infrastructure',
    'sports_office',
    'ssc'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.resource_kind as enum ('venue', 'equipment');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.resource_assignment_status as enum (
    'pending',
    'approved',
    'declined'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Venues: ownership + details
-- ---------------------------------------------------------------------------
alter table public.venues
  add column if not exists description text not null default '',
  add column if not exists location text not null default '',
  add column if not exists capacity integer,
  add column if not exists responsible_office public.resource_office not null default 'gso',
  add column if not exists availability text not null default 'available',
  add column if not exists status text not null default 'active';

update public.venues
set status = case when active then 'active' else 'inactive' end
where status is null or status = '';

-- ---------------------------------------------------------------------------
-- Equipment: ownership + details
-- ---------------------------------------------------------------------------
alter table public.equipment
  add column if not exists description text not null default '',
  add column if not exists responsible_office public.resource_office not null default 'gso',
  add column if not exists availability text not null default 'available',
  add column if not exists status text not null default 'active';

update public.equipment
set status = case when active then 'active' else 'inactive' end
where status is null or status = '';

-- ---------------------------------------------------------------------------
-- Link event requests to venue master row (optional; name still stored)
-- ---------------------------------------------------------------------------
alter table public.event_requests
  add column if not exists venue_id uuid references public.venues (id) on delete set null;

-- ---------------------------------------------------------------------------
-- EO resource assignments (parallel office approvals)
-- ---------------------------------------------------------------------------
create table if not exists public.event_request_resource_assignments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.event_requests (id) on delete cascade,
  resource_kind public.resource_kind not null,
  venue_id uuid references public.venues (id) on delete set null,
  equipment_id uuid references public.equipment (id) on delete set null,
  resource_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  assigned_office public.resource_office not null,
  status public.resource_assignment_status not null default 'pending',
  assigned_by uuid references auth.users (id) on delete set null,
  assigned_at timestamptz not null default now(),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  decline_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_request_resource_assignments_kind_check check (
    (resource_kind = 'venue' and length(trim(resource_name)) > 0)
    or (resource_kind = 'equipment' and length(trim(resource_name)) > 0)
  )
);

create index if not exists event_request_resource_assignments_request_idx
  on public.event_request_resource_assignments (request_id);

create index if not exists event_request_resource_assignments_office_status_idx
  on public.event_request_resource_assignments (assigned_office, status);

drop trigger if exists event_request_resource_assignments_updated_at on public.event_request_resource_assignments;
create trigger event_request_resource_assignments_updated_at
before update on public.event_request_resource_assignments
for each row execute function public.set_updated_at();

alter table public.event_request_resource_assignments enable row level security;

drop policy if exists err_assignments_select on public.event_request_resource_assignments;
create policy err_assignments_select on public.event_request_resource_assignments
  for select to authenticated
  using (
    exists (
      select 1 from public.event_requests r
      where r.id = request_id
        and (
          r.submitted_by = auth.uid()
          or public.has_role(auth.uid(), 'admin')
          or public.has_role(auth.uid(), 'eo')
          or public.has_role(auth.uid(), 'gso')
          or public.has_role(auth.uid(), 'it_infrastructure')
          or public.has_role(auth.uid(), 'sports_office')
          or public.has_role(auth.uid(), 'ssc')
          or public.has_role(auth.uid(), 'osas')
          or public.has_role(auth.uid(), 'adviser')
          or public.has_role(auth.uid(), 'dean')
        )
    )
  );

drop policy if exists err_assignments_eo_insert on public.event_request_resource_assignments;
create policy err_assignments_eo_insert on public.event_request_resource_assignments
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'eo') or public.has_role(auth.uid(), 'admin'));

drop policy if exists err_assignments_update on public.event_request_resource_assignments;
create policy err_assignments_update on public.event_request_resource_assignments
  for update to authenticated
  using (
    public.has_role(auth.uid(), 'eo')
    or public.has_role(auth.uid(), 'admin')
    or (
      assigned_office = 'gso' and public.has_role(auth.uid(), 'gso')
    )
    or (
      assigned_office = 'it_infrastructure' and public.has_role(auth.uid(), 'it_infrastructure')
    )
    or (
      assigned_office = 'sports_office' and public.has_role(auth.uid(), 'sports_office')
    )
    or (
      assigned_office = 'ssc' and public.has_role(auth.uid(), 'ssc')
    )
  )
  with check (
    public.has_role(auth.uid(), 'eo')
    or public.has_role(auth.uid(), 'admin')
    or (
      assigned_office = 'gso' and public.has_role(auth.uid(), 'gso')
    )
    or (
      assigned_office = 'it_infrastructure' and public.has_role(auth.uid(), 'it_infrastructure')
    )
    or (
      assigned_office = 'sports_office' and public.has_role(auth.uid(), 'sports_office')
    )
    or (
      assigned_office = 'ssc' and public.has_role(auth.uid(), 'ssc')
    )
  );

-- ---------------------------------------------------------------------------
-- Venue / equipment write policies for new offices
-- ---------------------------------------------------------------------------
drop policy if exists venues_gso_admin_write on public.venues;
drop policy if exists venues_office_write on public.venues;
create policy venues_office_write on public.venues
  for all to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'gso')
    or public.has_role(auth.uid(), 'sports_office')
    or public.has_role(auth.uid(), 'ssc')
  )
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'gso')
    or public.has_role(auth.uid(), 'sports_office')
    or public.has_role(auth.uid(), 'ssc')
  );

drop policy if exists equipment_gso_admin_write on public.equipment;
drop policy if exists equipment_office_write on public.equipment;
create policy equipment_office_write on public.equipment
  for all to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'gso')
    or public.has_role(auth.uid(), 'it_infrastructure')
    or public.has_role(auth.uid(), 'ssc')
  )
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'gso')
    or public.has_role(auth.uid(), 'it_infrastructure')
    or public.has_role(auth.uid(), 'ssc')
  );

drop policy if exists venues_select_authenticated on public.venues;
create policy venues_select_authenticated on public.venues
  for select to authenticated
  using (
    active
    or public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'gso')
    or public.has_role(auth.uid(), 'sports_office')
    or public.has_role(auth.uid(), 'ssc')
    or public.has_role(auth.uid(), 'eo')
  );

drop policy if exists equipment_select_authenticated on public.equipment;
create policy equipment_select_authenticated on public.equipment
  for select to authenticated
  using (
    active
    or public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'gso')
    or public.has_role(auth.uid(), 'it_infrastructure')
    or public.has_role(auth.uid(), 'ssc')
    or public.has_role(auth.uid(), 'eo')
  );

-- ---------------------------------------------------------------------------
-- Event request update policy: resource offices at resource_offices step
-- ---------------------------------------------------------------------------
drop policy if exists event_requests_update_staff on public.event_requests;

create policy event_requests_update_staff on public.event_requests
  for update to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and (
          ur.role = 'admin'
          or (
            ur.role = 'adviser'
            and event_requests.status = 'pending'
            and event_requests.current_step = 'adviser'
            and exists (
              select 1
              from public.profiles p
              where p.id = auth.uid()
                and p.organization_id = event_requests.organization_id
            )
          )
          or (
            ur.role = 'dean'
            and event_requests.status = 'pending'
            and event_requests.current_step = 'dean'
            and exists (
              select 1
              from public.profiles p
              join public.organizations o on o.id = event_requests.organization_id
              where p.id = auth.uid()
                and p.college_id = o.college_id
            )
          )
          or (
            ur.role = 'osas'
            and event_requests.status = 'pending'
            and event_requests.current_step = 'osas'
          )
          or (
            ur.role = 'gso'
            and event_requests.status = 'pending'
            and event_requests.current_step in ('gso', 'resource_offices')
          )
          or (
            ur.role in ('it_infrastructure', 'sports_office', 'ssc')
            and event_requests.status = 'pending'
            and event_requests.current_step = 'resource_offices'
          )
          or (
            ur.role = 'eo'
            and event_requests.current_step in ('eo_schedule', 'eo_publish', 'resource_offices')
            and event_requests.status in ('pending', 'approved')
          )
          or (
            ur.role in ('student_officer', 'ssc')
            and event_requests.submitted_by = auth.uid()
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in (
          'adviser', 'dean', 'osas', 'eo', 'gso', 'admin',
          'it_infrastructure', 'sports_office', 'ssc', 'student_officer'
        )
    )
  );
