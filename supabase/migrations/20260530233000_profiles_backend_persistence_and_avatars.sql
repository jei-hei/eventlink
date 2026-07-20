-- Persist profile settings and avatar uploads in backend.

alter table public.profiles
  add column if not exists department text not null default '',
  add column if not exists office text not null default '',
  add column if not exists position text not null default '',
  add column if not exists notify_email boolean not null default true,
  add column if not exists theme_preference text not null default 'system';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_theme_preference_check'
  ) then
    alter table public.profiles
      add constraint profiles_theme_preference_check
      check (theme_preference in ('system', 'light'));
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', true)
on conflict (id) do update
set public = true;

drop policy if exists profile_avatars_select_public on storage.objects;
create policy profile_avatars_select_public
on storage.objects for select
using (bucket_id = 'profile-avatars');

drop policy if exists profile_avatars_insert_own on storage.objects;
create policy profile_avatars_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists profile_avatars_update_own on storage.objects;
create policy profile_avatars_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists profile_avatars_delete_own on storage.objects;
create policy profile_avatars_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
