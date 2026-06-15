-- Campus feed posts (caption + image) — not tied to approval workflow
create table public.student_feed_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  submitted_by uuid not null references auth.users (id) on delete cascade,
  request_id uuid references public.event_requests (id) on delete set null,
  caption text not null,
  image_path text,
  event_title text not null,
  event_date text,
  event_time text,
  venue text,
  posted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index student_feed_posts_posted_at_idx on public.student_feed_posts (posted_at desc);
create index student_feed_posts_submitted_by_idx on public.student_feed_posts (submitted_by);

alter table public.student_feed_posts enable row level security;

create policy student_feed_posts_select_public on public.student_feed_posts
  for select using (true);

create policy student_feed_posts_insert_submitter on public.student_feed_posts
  for insert to authenticated
  with check (
    submitted_by = auth.uid()
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('student_officer', 'ssc')
    )
  );

create policy student_feed_posts_delete_own on public.student_feed_posts
  for delete to authenticated
  using (submitted_by = auth.uid());
