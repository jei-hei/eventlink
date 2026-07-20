-- Performance indexes for common workflow and feed filters.

create index if not exists event_requests_step_status_created_idx
  on public.event_requests (current_step, status, created_at desc);

create index if not exists event_requests_org_step_idx
  on public.event_requests (organization_id, current_step, status, created_at desc);

create index if not exists event_requests_submitter_created_idx
  on public.event_requests (submitted_by, created_at desc);

create index if not exists profiles_org_college_idx
  on public.profiles (organization_id, college_id);

create index if not exists student_feed_posts_org_posted_idx
  on public.student_feed_posts (organization_id, posted_at desc);
