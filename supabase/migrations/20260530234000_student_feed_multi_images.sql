-- Support multiple images per student feed post.

alter table public.student_feed_posts
  add column if not exists image_paths text[] not null default '{}'::text[];

-- Backfill existing single-image posts.
update public.student_feed_posts
set image_paths = case
  when image_path is null or btrim(image_path) = '' then '{}'::text[]
  else array[image_path]
end
where coalesce(array_length(image_paths, 1), 0) = 0;
