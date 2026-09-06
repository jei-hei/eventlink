-- Cleanup after mistakenly treating Infirmary as a resource_office.
-- Safe if 20260907000200 / 20260907000300 were already applied.
--
-- NOTE: Postgres cannot easily DROP an enum value. Leaving 'infirmary' on
-- public.resource_office is harmless — the app never assigns to it.
-- This migration only restores RLS so Infirmary cannot act as a resource office.

-- ---------------------------------------------------------------------------
-- Resource assignments: remove Infirmary from assignment select/update policies
-- ---------------------------------------------------------------------------
drop policy if exists err_assignments_select on public.event_request_resource_assignments;
create policy err_assignments_select on public.event_request_resource_assignments
  for select to authenticated
  using (
    exists (
      select 1 from public.event_requests r
      where r.id = request_id
        and (
          r.submitted_by = auth.uid()
          or public.has_role(auth.uid(), 'admin')
          or public.has_role(auth.uid(), 'eo')
          or public.has_role(auth.uid(), 'gso')
          or public.has_role(auth.uid(), 'it_infrastructure')
          or public.has_role(auth.uid(), 'sports_office')
          or public.has_role(auth.uid(), 'ssc')
          or public.has_role(auth.uid(), 'osas')
          or public.has_role(auth.uid(), 'adviser')
          or public.has_role(auth.uid(), 'dean')
        )
    )
  );

drop policy if exists err_assignments_update on public.event_request_resource_assignments;
create policy err_assignments_update on public.event_request_resource_assignments
  for update to authenticated
  using (
    public.has_role(auth.uid(), 'eo')
    or public.has_role(auth.uid(), 'admin')
    or (
      assigned_office = 'gso' and public.has_role(auth.uid(), 'gso')
    )
    or (
      assigned_office = 'it_infrastructure' and public.has_role(auth.uid(), 'it_infrastructure')
    )
    or (
      assigned_office = 'sports_office' and public.has_role(auth.uid(), 'sports_office')
    )
    or (
      assigned_office = 'ssc' and public.has_role(auth.uid(), 'ssc')
    )
  )
  with check (
    public.has_role(auth.uid(), 'eo')
    or public.has_role(auth.uid(), 'admin')
    or (
      assigned_office = 'gso' and public.has_role(auth.uid(), 'gso')
    )
    or (
      assigned_office = 'it_infrastructure' and public.has_role(auth.uid(), 'it_infrastructure')
    )
    or (
      assigned_office = 'sports_office' and public.has_role(auth.uid(), 'sports_office')
    )
    or (
      assigned_office = 'ssc' and public.has_role(auth.uid(), 'ssc')
    )
  );

-- ---------------------------------------------------------------------------
-- Event requests: restore staff update policy without Infirmary as a resource office
-- (matches 20260819000200 behaviour)
-- ---------------------------------------------------------------------------
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
            and event_requests.current_step in ('gso', 'resource_offices')
          )
          or (
            ur.role in ('it_infrastructure', 'sports_office', 'ssc')
            and event_requests.status = 'pending'
            and event_requests.current_step = 'resource_offices'
          )
          or (
            ur.role = 'eo'
            and (
              (
                event_requests.current_step in ('eo_schedule', 'eo_publish', 'resource_offices')
                and event_requests.status in ('pending', 'approved')
              )
              or (
                event_requests.calendar_posted_at is not null
                and event_requests.status in ('approved', 'posted', 'cancelled')
              )
            )
          )
          or (
            ur.role in ('student_officer', 'ssc')
            and event_requests.submitted_by = auth.uid()
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in (
          'adviser', 'dean', 'osas', 'eo', 'gso', 'admin',
          'it_infrastructure', 'sports_office', 'ssc', 'student_officer'
        )
    )
  );
