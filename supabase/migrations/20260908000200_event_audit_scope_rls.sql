-- Scope Event Trail / letters / compliance comments to the caller's portal role.
-- Campus calendar rows stay readable on event_requests; audit files are not campus-wide.

create or replace function public.can_view_event_request_audit(p_request_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.event_requests r
    left join public.organizations o on o.id = r.organization_id
    where r.id = p_request_id
      and (
        r.submitted_by = auth.uid()
        or public.has_role(auth.uid(), 'admin')
        or public.has_role(auth.uid(), 'eo')
        or public.has_role(auth.uid(), 'osas')
        or (
          public.has_role(auth.uid(), 'ssc')
          and r.request_type = 'ssc'
        )
        or (
          public.has_role(auth.uid(), 'student_officer')
          and (
            r.submitted_by = auth.uid()
            or r.organization_id = (
              select p.organization_id from public.profiles p where p.id = auth.uid()
            )
          )
        )
        or (
          public.has_role(auth.uid(), 'adviser')
          and r.organization_id is not null
          and r.organization_id = (
            select p.organization_id from public.profiles p where p.id = auth.uid()
          )
        )
        or (
          public.has_role(auth.uid(), 'dean')
          and o.college_id is not null
          and o.college_id = (
            select p.college_id from public.profiles p where p.id = auth.uid()
          )
        )
        or (
          public.has_role(auth.uid(), 'gso')
          and (
            r.current_step = 'gso'
            or exists (
              select 1
              from public.event_request_resource_assignments a
              where a.request_id = r.id
                and a.assigned_office = 'gso'
            )
          )
        )
        or (
          public.has_role(auth.uid(), 'it_infrastructure')
          and exists (
            select 1
            from public.event_request_resource_assignments a
            where a.request_id = r.id
              and a.assigned_office = 'it_infrastructure'
          )
        )
        or (
          public.has_role(auth.uid(), 'sports_office')
          and exists (
            select 1
            from public.event_request_resource_assignments a
            where a.request_id = r.id
              and a.assigned_office = 'sports_office'
          )
        )
        or (
          (public.has_role(auth.uid(), 'infirmary') or public.has_role(auth.uid(), 'nstp'))
          and r.calendar_posted_at is not null
          and r.deleted_at is null
        )
      )
  );
$$;

comment on function public.can_view_event_request_audit(uuid) is
  'Event Trail / letters / compliance comments: submitter, campus staff, org/college scope, or assigned resource office.';

grant execute on function public.can_view_event_request_audit(uuid) to authenticated;

drop policy if exists event_request_history_select_authenticated on public.event_request_history;
create policy event_request_history_select_authenticated on public.event_request_history
  for select to authenticated
  using (public.can_view_event_request_audit(request_id));

drop policy if exists event_request_letters_select on public.event_request_letters;
create policy event_request_letters_select on public.event_request_letters
  for select to authenticated
  using (public.can_view_event_request_audit(request_id));

drop policy if exists event_request_compliance_comments_select on public.event_request_compliance_comments;
create policy event_request_compliance_comments_select on public.event_request_compliance_comments
  for select to authenticated
  using (public.can_view_event_request_audit(request_id));

-- Signed URLs still check storage SELECT. Do not allow every authenticated user to open private files.
drop policy if exists event_letters_select_authenticated on storage.objects;
create policy event_letters_select_authenticated
on storage.objects for select to authenticated
using (
  bucket_id = 'event-letters'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (
      (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
      and public.can_view_event_request_audit(((storage.foldername(name))[2])::uuid)
    )
  )
);

drop policy if exists compliance_attachments_select_authenticated on storage.objects;
create policy compliance_attachments_select_authenticated
on storage.objects for select to authenticated
using (
  bucket_id = 'compliance-attachments'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (
      (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
      and public.can_view_event_request_audit(((storage.foldername(name))[2])::uuid)
    )
  )
);
