-- Allow EO/admin to replace resource assignments when re-forwarding a request.
drop policy if exists err_assignments_eo_delete on public.event_request_resource_assignments;
create policy err_assignments_eo_delete on public.event_request_resource_assignments
  for delete to authenticated
  using (public.has_role(auth.uid(), 'eo') or public.has_role(auth.uid(), 'admin'));
