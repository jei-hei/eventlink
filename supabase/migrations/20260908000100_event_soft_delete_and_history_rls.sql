-- Soft-delete for event_requests so Event Trail history is retained.
-- Tighten event_request_history SELECT so trail/files follow portal roles.
-- Does not recreate event_requests update policies (latest: 20260907000400).

alter table public.event_requests
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users (id) on delete set null,
  add column if not exists deleted_reason text;

create index if not exists event_requests_deleted_at_idx
  on public.event_requests (deleted_at)
  where deleted_at is null;

comment on column public.event_requests.deleted_at is
  'Soft delete timestamp. History rows are kept; calendar and pending queues hide the event.';

-- History: staff + submitter (aligned with event_request_letters), including Infirmary/NSTP.
drop policy if exists event_request_history_select_authenticated on public.event_request_history;
create policy event_request_history_select_authenticated on public.event_request_history
  for select to authenticated
  using (
    exists (
      select 1 from public.event_requests r
      where r.id = request_id
        and (
          r.submitted_by = auth.uid()
          or public.has_role(auth.uid(), 'admin')
          or public.has_role(auth.uid(), 'eo')
          or public.has_role(auth.uid(), 'osas')
          or public.has_role(auth.uid(), 'adviser')
          or public.has_role(auth.uid(), 'dean')
          or public.has_role(auth.uid(), 'gso')
          or public.has_role(auth.uid(), 'it_infrastructure')
          or public.has_role(auth.uid(), 'sports_office')
          or public.has_role(auth.uid(), 'ssc')
          or public.has_role(auth.uid(), 'student_officer')
          or public.has_role(auth.uid(), 'infirmary')
          or public.has_role(auth.uid(), 'nstp')
        )
    )
  );

drop policy if exists event_request_history_insert_authenticated on public.event_request_history;
create policy event_request_history_insert_authenticated on public.event_request_history
  for insert to authenticated
  with check (actor_id is null or actor_id = auth.uid());
