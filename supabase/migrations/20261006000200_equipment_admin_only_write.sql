-- Equipment catalog writes (add, edit, import) move to Admin only.
-- GSO / IT Infrastructure / SSC keep read access through equipment_select_authenticated.
-- Inventory allocation during approvals runs in security definer RPCs and is unaffected.

drop policy if exists equipment_office_write on public.equipment;
create policy equipment_office_write on public.equipment
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

comment on policy equipment_office_write on public.equipment is
  'Only Admin can add, edit, or import equipment. Offices have read-only access.';
