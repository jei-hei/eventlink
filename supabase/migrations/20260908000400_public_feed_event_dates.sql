-- Anon can read public-safe event_requests columns (already granted) for events
-- that appear on the public feed, not only status = 'posted'.
-- Needed so feedback eligibility can use start/end timestamps without exposing
-- letter_path, trail, or other internal columns.

drop policy if exists event_requests_select_posted_public on public.event_requests;
create policy event_requests_select_posted_public on public.event_requests
  for select to anon, authenticated
  using (
    status = 'posted'
    or exists (
      select 1
      from public.student_feed_posts p
      where p.request_id = event_requests.id
    )
  );

comment on policy event_requests_select_posted_public on public.event_requests is
  'Anonymous visitors may read public-safe columns of events that are posted or linked from the public feed.';
