-- EO posts to staff calendar; SSC / student officers post to the student dashboard.
alter table public.event_requests
  add column if not exists calendar_posted_at timestamptz;

comment on column public.event_requests.posted_at is 'When the org published to the student dashboard (/student).';
comment on column public.event_requests.calendar_posted_at is 'When the EO published to the staff schedule calendar.';

-- Venue conflicts: block if on staff calendar or any active booking status.
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
      and (
        r.status in ('pending', 'approved', 'posted')
        or r.calendar_posted_at is not null
      )
      and (p_exclude_id is null or r.id <> p_exclude_id)
      and daterange(r.start_date, r.end_date, '[]') && daterange(p_start, p_end, '[]')
  );
$$;
