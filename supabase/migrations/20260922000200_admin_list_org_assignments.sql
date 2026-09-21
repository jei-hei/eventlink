-- Admin-only listing of Student Officer / Adviser assignments by organization_id.
-- Used by Colleges UI (officer name next to each org) and Add/Edit User org labels.

create or replace function public.admin_list_org_assignments()
returns table (
  organization_id uuid,
  display_name text,
  app_role public.app_role
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.organization_id,
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), '')::text as display_name,
    ur.role as app_role
  from public.user_roles ur
  inner join public.profiles p on p.id = ur.user_id
  where public.has_role(auth.uid(), 'admin')
    and p.organization_id is not null
    and ur.role in ('student_officer', 'adviser');
$$;

revoke all on function public.admin_list_org_assignments() from public, anon;
grant execute on function public.admin_list_org_assignments() to authenticated;

comment on function public.admin_list_org_assignments() is
  'Admin-only: portal users assigned to an organization (Student Officer, Adviser).';
