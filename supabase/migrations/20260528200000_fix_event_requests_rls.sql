-- Fix RLS so student officers / SSC can submit events and attach letters.

-- Submitter may update own request while pending (e.g. letter_path after upload) or when resubmitting after decline
create policy event_requests_update_submitter_own on public.event_requests
  for update to authenticated
  using (
    submitted_by = auth.uid()
    and status in ('pending', 'declined')
  )
  with check (submitted_by = auth.uid());

-- Clearer insert check (same rules, avoids NULL edge cases from get_user_role)
drop policy if exists event_requests_insert_submitter on public.event_requests;

create policy event_requests_insert_submitter on public.event_requests
  for insert to authenticated
  with check (
    submitted_by = auth.uid()
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('student_officer', 'ssc', 'eo')
    )
  );

-- Staff updates must still satisfy with_check (not only using)
drop policy if exists event_requests_update_staff on public.event_requests;

create policy event_requests_update_staff on public.event_requests
  for update to authenticated
  using (
    public.get_user_role(auth.uid()) in ('adviser', 'dean', 'osas', 'eo', 'gso', 'admin')
  )
  with check (
    public.get_user_role(auth.uid()) in ('adviser', 'dean', 'osas', 'eo', 'gso', 'admin')
  );
