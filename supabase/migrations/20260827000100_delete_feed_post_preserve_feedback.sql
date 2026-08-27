-- Preserve event_feedback when a student feed post is deleted.
-- Feedback stays linked via request_id when present; feed_post_id becomes null.

do $$
declare
  fk_name text;
begin
  select conname into fk_name
  from pg_constraint
  where conrelid = 'public.event_feedback'::regclass
    and contype = 'f'
    and pg_get_constraintdef(oid) ilike '%feed_post_id%';
  if fk_name is not null then
    execute format('alter table public.event_feedback drop constraint %I', fk_name);
  end if;
end $$;

alter table public.event_feedback
  add constraint event_feedback_feed_post_id_fkey
  foreign key (feed_post_id) references public.student_feed_posts (id)
  on delete set null;

alter table public.event_feedback
  drop constraint if exists event_feedback_has_target;

-- Feedback may keep request_id after a post is removed; feed_post_id can become null.
-- Rows with neither may exist only after a post-only feedback post is deleted.

-- Allow post authors to attach request_id on feedback before deleting their post.
drop policy if exists event_feedback_update_post_owner on public.event_feedback;
create policy event_feedback_update_post_owner on public.event_feedback
  for update to authenticated
  using (
    exists (
      select 1
      from public.student_feed_posts p
      where p.id = event_feedback.feed_post_id
        and p.submitted_by = auth.uid()
    )
  )
  with check (true);

-- Allow post authors to remove their own feed images from storage.
drop policy if exists event_post_images_delete_own on storage.objects;
create policy event_post_images_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'event-post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
