-- Storage policies for event request Word letters (private bucket event-letters)

create policy event_letters_select_authenticated
on storage.objects for select to authenticated
using (bucket_id = 'event-letters');

create policy event_letters_insert_authenticated
on storage.objects for insert to authenticated
with check (
  bucket_id = 'event-letters'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy event_letters_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'event-letters'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy event_letters_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'event-letters'
  and (storage.foldername(name))[1] = auth.uid()::text
);
