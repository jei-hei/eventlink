-- SSC and student officers may publish their own approved requests (eo_publish step).
create policy event_requests_update_submitter_publish on public.event_requests
  for update to authenticated
  using (
    submitted_by = auth.uid()
    and current_step = 'eo_publish'
    and status in ('pending', 'approved')
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('student_officer', 'ssc')
    )
  )
  with check (
    submitted_by = auth.uid()
    and status = 'posted'
    and current_step is null
  );
