-- Students (and visitors) on /student can read posted events without staff login.
create policy event_requests_select_posted_public on public.event_requests
  for select to anon, authenticated
  using (status = 'posted');

create policy organizations_select_public on public.organizations
  for select to anon, authenticated
  using (true);
