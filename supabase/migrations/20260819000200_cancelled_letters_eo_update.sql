  -- Phase 2: cancellation fields, letter history, EO update for scheduled events.
  -- Run AFTER 20260819000100_cancelled_status_enum.sql has been applied (separate query).

  alter table public.event_requests
    add column if not exists cancellation_reason text,
    add column if not exists cancelled_at timestamptz,
    add column if not exists cancelled_by uuid references auth.users (id) on delete set null,
    add column if not exists original_letter_path text;

  -- Preserve first uploaded letter as original when letter_path already set.
  update public.event_requests
  set original_letter_path = letter_path
  where letter_path is not null
    and original_letter_path is null;

  create table if not exists public.event_request_letters (
    id uuid primary key default gen_random_uuid(),
    request_id uuid not null references public.event_requests (id) on delete cascade,
    letter_path text not null,
    label text not null default 'Letter',
    created_by uuid references auth.users (id) on delete set null,
    created_at timestamptz not null default now()
  );

  create index if not exists event_request_letters_request_idx
    on public.event_request_letters (request_id, created_at desc);

  alter table public.event_request_letters enable row level security;

  drop policy if exists event_request_letters_select on public.event_request_letters;
  create policy event_request_letters_select on public.event_request_letters
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

  drop policy if exists event_request_letters_insert on public.event_request_letters;
  create policy event_request_letters_insert on public.event_request_letters
    for insert to authenticated
    with check (
      exists (
        select 1 from public.event_requests r
        where r.id = request_id
          and (
            r.submitted_by = auth.uid()
            or public.has_role(auth.uid(), 'admin')
            or public.has_role(auth.uid(), 'eo')
          )
      )
    );

  -- Seed history from existing letter_path values.
  insert into public.event_request_letters (request_id, letter_path, label, created_by)
  select er.id, er.letter_path, 'Original proposal', er.submitted_by
  from public.event_requests er
  where er.letter_path is not null
    and not exists (
      select 1 from public.event_request_letters l where l.request_id = er.id and l.letter_path = er.letter_path
    );

  -- Allow EO to update/cancel scheduled events (calendar_posted).
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
