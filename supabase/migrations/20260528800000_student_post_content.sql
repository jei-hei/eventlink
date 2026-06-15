-- Facebook-style student post (caption + optional image) when SSC/officer publishes to /student
alter table public.event_requests
  add column if not exists student_post_caption text,
  add column if not exists student_post_image_path text;

comment on column public.event_requests.student_post_caption is 'Caption shown on the student dashboard feed.';
comment on column public.event_requests.student_post_image_path is 'Storage path in event-post-images bucket.';

insert into storage.buckets (id, name, public)
values ('event-post-images', 'event-post-images', true)
on conflict (id) do update set public = true;

create policy event_post_images_select_public
on storage.objects for select
using (bucket_id = 'event-post-images');

create policy event_post_images_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'event-post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy event_post_images_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'event-post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
