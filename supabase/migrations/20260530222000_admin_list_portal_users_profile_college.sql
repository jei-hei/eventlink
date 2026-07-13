-- Improve admin user directory values for non-student staff accounts.
-- Falls back to profile college/org when student registry row is not present.

create or replace function public.admin_list_portal_users()
returns table (
  user_id uuid,
  app_role public.app_role,
  display_name text,
  email text,
  student_id text,
  college text,
  program text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ur.user_id,
    ur.role,
    coalesce(nullif(trim(p.display_name), ''), '')::text as display_name,
    coalesce(p.email, '')::text as email,
    coalesce(p.student_id, '')::text as student_id,
    coalesce(
      nullif(trim(s.course), ''),
      nullif(trim(c.name), ''),
      ''
    )::text as college,
    coalesce(
      nullif(trim(s.program), ''),
      nullif(trim(o.name), ''),
      ''
    )::text as program
  from public.user_roles ur
  left join public.profiles p on p.id = ur.user_id
  left join public.students s
    on p.student_id is not null
    and upper(trim(s.student_id)) = upper(trim(p.student_id))
    and not s.archived
  left join public.colleges c on c.id = p.college_id
  left join public.organizations o on o.id = p.organization_id
  where public.has_role(auth.uid(), 'admin');
$$;

revoke all on function public.admin_list_portal_users() from public;
grant execute on function public.admin_list_portal_users() to authenticated;
