-- Phase 3b: Compliance/revision comments + attachment storage.
-- Run AFTER 20260826000100_revision_requested_status.sql has been applied (separate query).

create table if not exists public.event_request_compliance_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.event_requests (id) on delete cascade,
  comment text not null,
  attachment_path text,
  attachment_name text,
  sender_id uuid references auth.users (id) on delete set null,
  sender_role text not null,
  created_at timestamptz not null default now()
);

create index if not exists event_request_compliance_comments_request_idx
  on public.event_request_compliance_comments (request_id, created_at desc);

alter table public.event_request_compliance_comments enable row level security;

drop policy if exists event_request_compliance_comments_select on public.event_request_compliance_comments;
create policy event_request_compliance_comments_select on public.event_request_compliance_comments
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
        )
    )
  );

drop policy if exists event_request_compliance_comments_insert on public.event_request_compliance_comments;
create policy event_request_compliance_comments_insert on public.event_request_compliance_comments
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.event_requests r
      where r.id = request_id
        and (
          public.has_role(auth.uid(), 'eo')
          or public.has_role(auth.uid(), 'osas')
          or public.has_role(auth.uid(), 'adviser')
          or public.has_role(auth.uid(), 'dean')
          or public.has_role(auth.uid(), 'admin')
        )
    )
  );

insert into storage.buckets (id, name, public)
values ('compliance-attachments', 'compliance-attachments', false)
on conflict (id) do nothing;

drop policy if exists compliance_attachments_select_authenticated on storage.objects;
create policy compliance_attachments_select_authenticated
on storage.objects for select to authenticated
using (bucket_id = 'compliance-attachments');

drop policy if exists compliance_attachments_insert_authenticated on storage.objects;
create policy compliance_attachments_insert_authenticated
on storage.objects for insert to authenticated
with check (
  bucket_id = 'compliance-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists compliance_attachments_update_own on storage.objects;
create policy compliance_attachments_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'compliance-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow submitters to resubmit when status is revision_requested (same as declined).

drop policy if exists event_requests_update_submitter_declined on public.event_requests;
create policy event_requests_update_submitter_declined on public.event_requests
  for update to authenticated
  using (
    submitted_by = auth.uid()
    and status in ('declined', 'revision_requested')
  )
  with check (submitted_by = auth.uid());
