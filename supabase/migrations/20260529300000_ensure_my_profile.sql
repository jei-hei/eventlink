-- Repair missing public.profiles row for auth users (e.g. created before trigger or via Dashboard).
create or replace function public.ensure_my_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  au record;
  sid text;
  sname text;
begin
  if uid is null then
    return;
  end if;

  if exists (select 1 from public.profiles p where p.id = uid) then
    return;
  end if;

  select id, email, raw_user_meta_data
  into au
  from auth.users
  where id = uid;

  if not found then
    return;
  end if;

  sid := upper(trim(coalesce(au.raw_user_meta_data ->> 'student_id', '')));
  sname := coalesce(
    au.raw_user_meta_data ->> 'full_name',
    nullif(trim(coalesce(au.raw_user_meta_data ->> 'display_name', '')), ''),
    split_part(coalesce(au.email, ''), '@', 1)
  );

  insert into public.profiles (id, display_name, email, student_id)
  values (
    uid,
    coalesce(nullif(trim(sname), ''), 'User'),
    au.email,
    case when sid = '' then null else sid end
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (uid, 'student')
  on conflict (user_id) do nothing;
end;
$$;

grant execute on function public.ensure_my_profile() to authenticated;
