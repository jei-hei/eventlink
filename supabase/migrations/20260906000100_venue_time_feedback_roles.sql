-- Venue conflict: venue + date range + time range overlap.
-- Cancelled/declined do not block. Exclude current request when editing.
-- Also: feedback access code on student_feed_posts; infirmary/nstp roles.

-- 1) Time-aware venue availability
create or replace function public.check_venue_availability(
  p_venue text,
  p_start date,
  p_end date,
  p_exclude_id uuid default null,
  p_start_time time default null,
  p_end_time time default null
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
      and r.status in ('pending', 'approved', 'posted', 'revision_requested')
      and (p_exclude_id is null or r.id <> p_exclude_id)
      and daterange(r.start_date, r.end_date, '[]') && daterange(p_start, p_end, '[]')
      and (
        -- If either side lacks times, fall back to date-only overlap (legacy rows).
        p_start_time is null
        or p_end_time is null
        or r.start_time is null
        or r.end_time is null
        or (
          -- Overlap: existing_start < requested_end AND existing_end > requested_start
          -- For multi-day date overlaps, treat full-day booking as conflicting when times overlap
          -- on the overlapping calendar days (same rule as single-day).
          r.start_time < p_end_time
          and r.end_time > p_start_time
        )
      )
  );
$$;

comment on function public.check_venue_availability(text, date, date, uuid, time, time) is
  'Returns true when venue is free for date range + optional time range. Cancelled/declined ignored.';

grant execute on function public.check_venue_availability(text, date, date, uuid, time, time) to authenticated;
grant execute on function public.check_venue_availability(text, date, date, uuid) to authenticated;

-- Keep 4-arg overload callable by older clients (date-only → treat as full-day conflict).
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
  select public.check_venue_availability(p_venue, p_start, p_end, p_exclude_id, null::time, null::time);
$$;

-- 2) Optional feedback access code (never exposed via public select of secrets in app)
alter table public.student_feed_posts
  add column if not exists require_feedback_access_code boolean not null default false;

alter table public.student_feed_posts
  add column if not exists feedback_access_code_hash text;

comment on column public.student_feed_posts.require_feedback_access_code is
  'When true, feedback submitters must provide the matching access code.';
comment on column public.student_feed_posts.feedback_access_code_hash is
  'SHA-256 hex of access code. Never return to anonymous clients.';

-- 3) Infirmary + NSTP calendar-only roles
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'app_role' and e.enumlabel = 'infirmary'
  ) then
    alter type public.app_role add value 'infirmary';
  end if;
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'app_role' and e.enumlabel = 'nstp'
  ) then
    alter type public.app_role add value 'nstp';
  end if;
end$$;
