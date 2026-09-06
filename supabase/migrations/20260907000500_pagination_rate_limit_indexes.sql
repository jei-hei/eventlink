-- Rate limiting + common list/query indexes for EventLink scalability.
-- check_rate_limit is security-definer and keyed by auth.uid() (or anon IP hash via key_extra).

create table if not exists public.rate_limit_buckets (
  id uuid primary key default gen_random_uuid(),
  bucket_key text not null,
  action text not null,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  updated_at timestamptz not null default now(),
  unique (bucket_key, action)
);

create index if not exists rate_limit_buckets_updated_idx
  on public.rate_limit_buckets (updated_at);

alter table public.rate_limit_buckets enable row level security;

-- No direct client access; only via RPC.
drop policy if exists rate_limit_buckets_deny_all on public.rate_limit_buckets;
create policy rate_limit_buckets_deny_all on public.rate_limit_buckets
  for all to authenticated
  using (false)
  with check (false);

create or replace function public.check_rate_limit(
  p_action text,
  p_key_extra text default null,
  p_max_attempts integer default 20,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_key text;
  v_row public.rate_limit_buckets%rowtype;
  v_now timestamptz := now();
  v_max integer := greatest(1, least(coalesce(p_max_attempts, 20), 200));
  v_window integer := greatest(5, least(coalesce(p_window_seconds, 60), 3600));
begin
  if p_action is null or length(trim(p_action)) = 0 then
    return true;
  end if;

  v_key := coalesce(v_uid::text, 'anon') || ':' || coalesce(nullif(trim(p_key_extra), ''), '-');

  select * into v_row
  from public.rate_limit_buckets
  where bucket_key = v_key and action = p_action
  for update;

  if not found then
    insert into public.rate_limit_buckets (bucket_key, action, window_started_at, attempt_count, updated_at)
    values (v_key, p_action, v_now, 1, v_now);
    return true;
  end if;

  if v_row.window_started_at < (v_now - make_interval(secs => v_window)) then
    update public.rate_limit_buckets
    set window_started_at = v_now,
        attempt_count = 1,
        updated_at = v_now
    where id = v_row.id;
    return true;
  end if;

  if v_row.attempt_count >= v_max then
    return false;
  end if;

  update public.rate_limit_buckets
  set attempt_count = attempt_count + 1,
      updated_at = v_now
  where id = v_row.id;

  return true;
end;
$$;

revoke all on function public.check_rate_limit(text, text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, text, integer, integer) to authenticated;
grant execute on function public.check_rate_limit(text, text, integer, integer) to anon;

-- ---------------------------------------------------------------------------
-- Paginated admin user directory (server-side search + page)
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_portal_users_page(
  p_search text default null,
  p_role public.app_role default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  app_role public.app_role,
  display_name text,
  email text,
  student_id text,
  college text,
  program text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 100));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_q text := nullif(lower(trim(coalesce(p_search, ''))), '');
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'not authorized';
  end if;

  return query
  with base as (
    select
      ur.user_id,
      ur.role as app_role,
      coalesce(nullif(trim(p.display_name), ''), '')::text as display_name,
      coalesce(p.email, '')::text as email,
      coalesce(p.student_id, '')::text as student_id,
      coalesce(
        nullif(trim(s.course), ''),
        nullif(trim(c.name), ''),
        ''
      )::text as college,
      coalesce(
        nullif(trim(s.program), ''),
        nullif(trim(o.name), ''),
        ''
      )::text as program
    from public.user_roles ur
    left join public.profiles p on p.id = ur.user_id
    left join public.students s
      on p.student_id is not null
      and upper(trim(s.student_id)) = upper(trim(p.student_id))
      and not s.archived
    left join public.colleges c on c.id = p.college_id
    left join public.organizations o on o.id = p.organization_id
    where (p_role is null or ur.role = p_role)
      and (
        v_q is null
        or lower(coalesce(p.display_name, '')) like '%' || v_q || '%'
        or lower(coalesce(p.email, '')) like '%' || v_q || '%'
        or ur.user_id::text like '%' || v_q || '%'
        or lower(ur.role::text) like '%' || v_q || '%'
      )
  ),
  counted as (
    select b.*, (select count(*) from base)::bigint as total_count
    from base b
  )
  select *
  from counted
  order by display_name asc, email asc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.admin_list_portal_users_page(text, public.app_role, integer, integer) from public;
grant execute on function public.admin_list_portal_users_page(text, public.app_role, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Indexes for common filter/sort/pagination patterns
-- ---------------------------------------------------------------------------
create index if not exists event_requests_created_at_idx
  on public.event_requests (created_at desc);

create index if not exists event_requests_status_created_idx
  on public.event_requests (status, created_at desc);

create index if not exists event_requests_current_step_status_idx
  on public.event_requests (current_step, status)
  where status = 'pending';

create index if not exists event_requests_org_created_idx
  on public.event_requests (organization_id, created_at desc);

create index if not exists event_requests_submitted_by_idx
  on public.event_requests (submitted_by, created_at desc);

create index if not exists event_requests_calendar_range_idx
  on public.event_requests (start_date, end_date)
  where calendar_posted_at is not null;

create index if not exists event_requests_venue_idx
  on public.event_requests (venue);

create index if not exists event_request_history_created_idx
  on public.event_request_history (created_at desc);

create index if not exists event_request_history_request_created_idx
  on public.event_request_history (request_id, created_at desc);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create index if not exists venues_office_name_idx
  on public.venues (responsible_office, name);

create index if not exists equipment_office_name_idx
  on public.equipment (responsible_office, name);

create index if not exists organizations_college_idx
  on public.organizations (college_id);

create index if not exists profiles_college_idx
  on public.profiles (college_id);

create index if not exists profiles_organization_idx
  on public.profiles (organization_id);
