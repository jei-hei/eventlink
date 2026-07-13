-- Enforce scoped staff approvals:
-- adviser -> only same organization
-- dean -> only same college
-- osas/gso/eo -> only their current workflow step

drop policy if exists event_requests_update_staff on public.event_requests;

create policy event_requests_update_staff on public.event_requests
  for update to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and (
          ur.role = 'admin'
          or (
            ur.role = 'adviser'
            and event_requests.status = 'pending'
            and event_requests.current_step = 'adviser'
            and exists (
              select 1
              from public.profiles p
              where p.id = auth.uid()
                and p.organization_id = event_requests.organization_id
            )
          )
          or (
            ur.role = 'dean'
            and event_requests.status = 'pending'
            and event_requests.current_step = 'dean'
            and exists (
              select 1
              from public.profiles p
              join public.organizations o on o.id = event_requests.organization_id
              where p.id = auth.uid()
                and p.college_id = o.college_id
            )
          )
          or (
            ur.role = 'osas'
            and event_requests.status = 'pending'
            and event_requests.current_step = 'osas'
          )
          or (
            ur.role = 'gso'
            and event_requests.status = 'pending'
            and event_requests.current_step = 'gso'
          )
          or (
            ur.role = 'eo'
            and event_requests.current_step in ('eo_schedule', 'eo_publish')
            and event_requests.status in ('pending', 'approved')
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('adviser', 'dean', 'osas', 'eo', 'gso', 'admin')
    )
  );
