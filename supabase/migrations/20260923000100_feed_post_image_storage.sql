-- Allow SSC/officer feed-post photos. Paths are {auth.uid()}/{uuid}/{file}.
-- uuid may be student_feed_posts.id (campus posts) or event_requests.id (publish-to-students).

create or replace function public.can_write_event_post_image(p_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  v_parts text[];
  v_id uuid;
begin
  if auth.uid() is null or nullif(trim(coalesce(p_path, '')), '') is null then
    return false;
  end if;

  v_parts := storage.foldername(p_path);
  if coalesce(array_length(v_parts, 1), 0) <> 2
     or v_parts[1] <> auth.uid()::text
     or v_parts[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  v_id := v_parts[2]::uuid;

  return exists (
    select 1
    from public.student_feed_posts p
    where p.id = v_id
      and p.submitted_by = auth.uid()
  ) or exists (
    select 1
    from public.event_requests r
    where r.id = v_id
      and r.submitted_by = auth.uid()
  );
exception
  when invalid_text_representation then
    return false;
end;
$$;

revoke all on function public.can_write_event_post_image(text) from public, anon;
grant execute on function public.can_write_event_post_image(text) to authenticated;

drop policy if exists event_post_images_insert_own on storage.objects;
create policy event_post_images_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'event-post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.can_write_event_post_image(name)
);

drop policy if exists event_post_images_update_own on storage.objects;
create policy event_post_images_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'event-post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'event-post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.can_write_event_post_image(name)
);
