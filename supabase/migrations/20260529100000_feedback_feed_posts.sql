-- Feedback on campus feed posts (and optional link to event request)
alter table public.event_feedback
  alter column request_id drop not null;

alter table public.event_feedback
  add column if not exists feed_post_id uuid references public.student_feed_posts (id) on delete cascade;

alter table public.event_feedback
  drop constraint if exists event_feedback_has_target;

alter table public.event_feedback
  add constraint event_feedback_has_target check (
    request_id is not null or feed_post_id is not null
  );

create index if not exists event_feedback_feed_post_id_idx on public.event_feedback (feed_post_id);

drop policy if exists event_feedback_insert_authenticated on public.event_feedback;

create policy event_feedback_insert_public on public.event_feedback
  for insert
  with check (feed_post_id is not null);
