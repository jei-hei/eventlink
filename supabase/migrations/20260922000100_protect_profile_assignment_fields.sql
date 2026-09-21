-- Prevent non-admin users from changing assignment fields on their own profile.
-- Service-role Edge Functions run with auth.uid() IS NULL and remain able to provision.

create or replace function public.protect_profile_assignment_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if public.has_role(auth.uid(), 'admin') then
    return new;
  end if;
  if new.college_id is distinct from old.college_id
     or new.organization_id is distinct from old.organization_id
     or new.student_id is distinct from old.student_id then
    raise exception 'College, organization, and student ID cannot be changed from the profile.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_assignment_fields on public.profiles;
create trigger protect_profile_assignment_fields
before update on public.profiles
for each row execute function public.protect_profile_assignment_fields();

revoke all on function public.protect_profile_assignment_fields() from public, anon, authenticated;

comment on function public.protect_profile_assignment_fields() is
  'Blocks non-admin updates to profiles.college_id, organization_id, and student_id.';
