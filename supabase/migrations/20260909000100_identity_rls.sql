-- Identity and row-level-security hardening.
-- Forward-only and data-preserving: existing profiles, roles, requests, and feedback remain intact.

-- ---------------------------------------------------------------------------
-- Identity bootstrap: auth metadata is profile input, never role authority.
-- Portal roles must be assigned through the privileged user_roles administration path.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sid text;
  sname text;
begin
  sid := upper(trim(coalesce(new.raw_user_meta_data ->> 'student_id', '')));
  sname := coalesce(
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'User'
  );

  insert into public.profiles (id, display_name, email, student_id)
  values (
    new.id,
    sname,
    new.email,
    case when sid = '' then null else sid end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.ensure_my_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  au record;
  sid text;
  sname text;
begin
  if uid is null then
    return;
  end if;

  select id, email, raw_user_meta_data
  into au
  from auth.users
  where id = uid;

  if not found then
    return;
  end if;

  sid := upper(trim(coalesce(au.raw_user_meta_data ->> 'student_id', '')));
  sname := coalesce(
    nullif(trim(coalesce(au.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(au.raw_user_meta_data ->> 'display_name', '')), ''),
    split_part(coalesce(au.email, ''), '@', 1),
    'User'
  );

  insert into public.profiles (id, display_name, email, student_id)
  values (
    uid,
    sname,
    au.email,
    case when sid = '' then null else sid end
  )
  on conflict (id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Event request visibility.
-- This definer helper bypasses event_requests RLS only to evaluate the caller's
-- role and scope; it returns a boolean and cannot disclose request data.
-- ---------------------------------------------------------------------------
create or replace function public.can_view_event_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with actor as (
    select ur.role, p.organization_id, p.college_id
    from public.user_roles ur
    left join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
  )
  select exists (
    select 1
    from public.event_requests r
    left join public.organizations o on o.id = r.organization_id
    cross join actor a
    where r.id = p_request_id
      and (r.deleted_at is null or a.role in ('admin', 'eo'))
      and (
        a.role in ('admin', 'eo')
        or r.submitted_by = auth.uid()
        or r.calendar_posted_at is not null
        or exists (
          select 1
          from public.student_feed_posts sfp
          where sfp.request_id = r.id
        )
        or (
          a.role = 'student_officer'
          and a.organization_id is not null
          and r.organization_id = a.organization_id
        )
        or (
          a.role = 'ssc'
          and (
            r.request_type = 'ssc'
            or exists (
              select 1
              from public.event_request_resource_assignments ra
              where ra.request_id = r.id
                and ra.assigned_office::text = 'ssc'
            )
          )
        )
        or (
          a.role = 'adviser'
          and a.organization_id is not null
          and r.organization_id = a.organization_id
        )
        or (
          a.role = 'dean'
          and a.college_id is not null
          and o.college_id = a.college_id
        )
        -- OSAS is the campus-wide monitoring office. This policy applies only
        -- to authenticated callers, so private request columns remain private.
        or a.role = 'osas'
        or (
          a.role = 'gso'
          and (
            r.current_step = 'gso'
            or exists (
              select 1
              from public.event_request_resource_assignments ra
              where ra.request_id = r.id
                and ra.assigned_office::text = 'gso'
            )
          )
        )
        or (
          a.role in ('it_infrastructure', 'sports_office')
          and exists (
            select 1
            from public.event_request_resource_assignments ra
            where ra.request_id = r.id
              and ra.assigned_office::text = a.role::text
          )
        )
        or (
          a.role in ('infirmary', 'nstp')
          and r.calendar_posted_at is not null
        )
      )
  );
$$;

-- Detail scope excludes the calendar-only fallback and is used by child tables.
create or replace function public.can_access_event_request_details(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with actor as (
    select ur.role, p.organization_id, p.college_id
    from public.user_roles ur
    left join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
  )
  select exists (
    select 1
    from public.event_requests r
    left join public.organizations o on o.id = r.organization_id
    cross join actor a
    where r.id = p_request_id
      and (r.deleted_at is null or a.role in ('admin', 'eo'))
      and (
        a.role in ('admin', 'eo')
        or r.submitted_by = auth.uid()
        or (
          a.role in ('student_officer', 'adviser')
          and a.organization_id is not null
          and r.organization_id = a.organization_id
        )
        or (
          a.role = 'dean'
          and a.college_id is not null
          and o.college_id = a.college_id
        )
        or (a.role = 'osas' and r.current_step = 'osas')
        or (
          a.role = 'ssc'
          and (
            r.request_type = 'ssc'
            or exists (
              select 1
              from public.event_request_resource_assignments ra
              where ra.request_id = r.id
                and ra.assigned_office::text = 'ssc'
            )
          )
        )
        or (
          a.role = 'gso'
          and (
            r.current_step = 'gso'
            or exists (
              select 1
              from public.event_request_resource_assignments ra
              where ra.request_id = r.id
                and ra.assigned_office::text = 'gso'
            )
          )
        )
        or (
          a.role in ('it_infrastructure', 'sports_office')
          and exists (
            select 1
            from public.event_request_resource_assignments ra
            where ra.request_id = r.id
              and ra.assigned_office::text = a.role::text
          )
        )
      )
  );
$$;

drop policy if exists event_requests_select_authenticated on public.event_requests;
drop policy if exists event_requests_select_scoped on public.event_requests;
create policy event_requests_select_scoped on public.event_requests
  for select to authenticated
  using (public.can_view_event_request(id));

-- Anonymous access remains row- and column-limited. Authenticated access is
-- governed exclusively by event_requests_select_scoped.
drop policy if exists event_requests_select_posted_public on public.event_requests;
create policy event_requests_select_posted_public on public.event_requests
  for select to anon
  using (
    deleted_at is null
    and (
      status = 'posted'
      or exists (
        select 1
        from public.student_feed_posts p
        where p.request_id = event_requests.id
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Public feed author projection: expose only display fields, not profiles rows.
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_feed_authors on public.profiles;

create or replace function public.get_public_feed_author_profiles(p_user_ids uuid[])
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  organization_name text,
  college_name text,
  college_code text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.display_name,
    p.avatar_url,
    o.name as organization_name,
    c.name as college_name,
    c.code as college_code
  from public.profiles p
  left join public.organizations o on o.id = p.organization_id
  left join public.colleges c on c.id = p.college_id
  where p.id = any(coalesce(p_user_ids, '{}'::uuid[]))
    and coalesce(array_length(p_user_ids, 1), 0) <= 100
    and exists (
      select 1
      from public.student_feed_posts sfp
      where sfp.submitted_by = p.id
    );
$$;

-- ---------------------------------------------------------------------------
-- Child-table RLS.
-- ---------------------------------------------------------------------------
drop policy if exists event_request_equipment_all_authenticated on public.event_request_equipment;
drop policy if exists event_request_equipment_select_scoped on public.event_request_equipment;
create policy event_request_equipment_select_scoped on public.event_request_equipment
  for select to authenticated
  using (public.can_access_event_request_details(request_id));

drop policy if exists event_request_equipment_insert_scoped on public.event_request_equipment;
create policy event_request_equipment_insert_scoped on public.event_request_equipment
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.event_requests r
      where r.id = request_id
        and (
          (
            r.submitted_by = auth.uid()
            and r.status in ('pending', 'declined', 'revision_requested')
            and public.get_user_role(auth.uid()) in ('student_officer', 'ssc', 'eo')
          )
          or public.get_user_role(auth.uid()) in ('admin', 'eo')
        )
    )
  );

drop policy if exists event_request_equipment_update_scoped on public.event_request_equipment;
create policy event_request_equipment_update_scoped on public.event_request_equipment
  for update to authenticated
  using (
    exists (
      select 1 from public.event_requests r
      where r.id = request_id
        and (
          (r.submitted_by = auth.uid() and r.status in ('pending', 'declined', 'revision_requested'))
          or public.get_user_role(auth.uid()) in ('admin', 'eo')
        )
    )
  )
  with check (
    exists (
      select 1 from public.event_requests r
      where r.id = request_id
        and (
          (r.submitted_by = auth.uid() and r.status in ('pending', 'declined', 'revision_requested'))
          or public.get_user_role(auth.uid()) in ('admin', 'eo')
        )
    )
  );

drop policy if exists event_request_equipment_delete_scoped on public.event_request_equipment;
create policy event_request_equipment_delete_scoped on public.event_request_equipment
  for delete to authenticated
  using (
    exists (
      select 1 from public.event_requests r
      where r.id = request_id
        and (
          (r.submitted_by = auth.uid() and r.status in ('pending', 'declined', 'revision_requested'))
          or public.get_user_role(auth.uid()) in ('admin', 'eo')
        )
    )
  );

-- History is append-only through the canonical security-definer workflow RPCs
-- introduced by the following workflow migration. Browser clients cannot forge
-- actions, actors, workflow steps, or metadata directly.
drop policy if exists event_request_history_insert_authenticated on public.event_request_history;
revoke insert on table public.event_request_history from authenticated;

drop policy if exists event_feedback_select_org on public.event_feedback;
drop policy if exists event_feedback_select_scoped on public.event_feedback;
create policy event_feedback_select_scoped on public.event_feedback
  for select to authenticated
  using (
    public.get_user_role(auth.uid()) in ('admin', 'eo', 'osas')
    or exists (
      select 1
      from public.student_feed_posts sfp
      left join public.event_requests r on r.id = coalesce(event_feedback.request_id, sfp.request_id)
      left join public.organizations o on o.id = coalesce(sfp.organization_id, r.organization_id)
      left join public.profiles p on p.id = auth.uid()
      where sfp.id = event_feedback.feed_post_id
        and (
          sfp.submitted_by = auth.uid()
          or r.submitted_by = auth.uid()
          or (
            public.get_user_role(auth.uid()) in ('student_officer', 'adviser')
            and p.organization_id is not null
            and p.organization_id = coalesce(sfp.organization_id, r.organization_id)
          )
          or (
            public.get_user_role(auth.uid()) = 'dean'
            and p.college_id is not null
            and p.college_id = o.college_id
          )
          or (
            public.get_user_role(auth.uid()) = 'ssc'
            and (r.request_type = 'ssc' or sfp.submitted_by = auth.uid())
          )
        )
    )
    or (
      feed_post_id is null
      and request_id is not null
      and public.can_access_event_request_details(request_id)
      and public.get_user_role(auth.uid()) in (
        'student_officer', 'ssc', 'adviser', 'dean', 'osas', 'eo', 'admin'
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Fixed server-side rate-limit policy. Compatibility parameters remain in the
-- signature, but callers cannot alter the selected action's limits.
-- ---------------------------------------------------------------------------
create or replace function public.check_rate_limit(
  p_action text,
  p_key_extra text default null,
  p_max_attempts integer default 20,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_action text := lower(trim(coalesce(p_action, '')));
  v_key text;
  v_row public.rate_limit_buckets%rowtype;
  v_now timestamptz := now();
  v_max integer;
  v_window integer;
begin
  select limits.max_attempts, limits.window_seconds
  into v_max, v_window
  from (
    values
      ('login', 8, 900),
      ('password_reset', 5, 900),
      ('event_submit', 10, 60),
      ('event_mutate', 30, 30),
      ('feedback_submit', 12, 60),
      ('file_upload', 15, 60),
      ('search', 40, 10),
      ('student_registry_verify', 12, 900),
      ('student_registry_lookup', 6, 900)
  ) as limits(action, max_attempts, window_seconds)
  where limits.action = v_action;

  if not found then
    return false;
  end if;

  -- p_max_attempts and p_window_seconds are intentionally ignored.
  v_key := coalesce(v_uid::text, 'anon') || ':' || coalesce(nullif(trim(p_key_extra), ''), '-');

  insert into public.rate_limit_buckets (
    bucket_key, action, window_started_at, attempt_count, updated_at
  )
  values (v_key, v_action, v_now, 0, v_now)
  on conflict (bucket_key, action) do nothing;

  select *
  into v_row
  from public.rate_limit_buckets
  where bucket_key = v_key and action = v_action
  for update;

  if v_row.window_started_at < (v_now - make_interval(secs => v_window)) then
    update public.rate_limit_buckets
    set window_started_at = v_now,
        attempt_count = 1,
        updated_at = v_now
    where id = v_row.id;
    return true;
  end if;

  if v_row.attempt_count >= v_max then
    return false;
  end if;

  update public.rate_limit_buckets
  set attempt_count = attempt_count + 1,
      updated_at = v_now
  where id = v_row.id;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pre-auth signup registry validation.
-- Exact-ID RPCs remain compatible with SignupView, but cannot scan the table
-- and are rate-limited by a one-way hash of the gateway-provided client address.
-- ---------------------------------------------------------------------------
create or replace function public.student_registry_rate_limit_key()
returns text
language sql
stable
security definer
set search_path = public
as $$
  with headers as (
    select coalesce(
      nullif(current_setting('request.headers', true), ''),
      '{}'
    )::jsonb as value
  )
  select md5(
    coalesce(
      nullif(trim(split_part(coalesce(value ->> 'x-forwarded-for', ''), ',', 1)), ''),
      nullif(trim(coalesce(value ->> 'cf-connecting-ip', '')), ''),
      nullif(trim(coalesce(value ->> 'x-real-ip', '')), ''),
      'unknown'
    )
  )
  from headers;
$$;

create or replace function public.verify_student_registry(p_student_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.check_rate_limit(
    'student_registry_verify',
    public.student_registry_rate_limit_key()
  ) then
    raise exception 'Too many registry verification attempts. Please try again later.'
      using errcode = 'P0001';
  end if;

  return exists (
    select 1
    from public.students s
    where upper(trim(s.student_id)) = upper(trim(p_student_id))
      and not s.archived
  );
end;
$$;

create or replace function public.get_student_registry_row(p_student_id text)
returns table (
  student_id text,
  full_name text,
  email text,
  college text,
  program text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.check_rate_limit(
    'student_registry_lookup',
    public.student_registry_rate_limit_key()
  ) then
    raise exception 'Too many registry lookup attempts. Please try again later.'
      using errcode = 'P0001';
  end if;

  return query
  select s.student_id, s.full_name, s.email, s.course, s.program
  from public.students s
  where upper(trim(s.student_id)) = upper(trim(p_student_id))
    and not s.archived
  limit 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- Execute grants: remove PostgreSQL's default PUBLIC execute from definer
-- functions, then grant only to the roles that need each entry point.
-- ---------------------------------------------------------------------------
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.ensure_my_profile() from public, anon, authenticated;
grant execute on function public.ensure_my_profile() to authenticated;

revoke all on function public.get_user_role(uuid) from public, anon, authenticated;
grant execute on function public.get_user_role(uuid) to authenticated;
revoke all on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

revoke all on function public.can_view_event_request(uuid) from public, anon, authenticated;
grant execute on function public.can_view_event_request(uuid) to authenticated;
revoke all on function public.can_access_event_request_details(uuid) from public, anon, authenticated;
grant execute on function public.can_access_event_request_details(uuid) to authenticated;
revoke all on function public.can_view_event_request_audit(uuid) from public, anon, authenticated;
grant execute on function public.can_view_event_request_audit(uuid) to authenticated;

revoke all on function public.get_public_feed_author_profiles(uuid[]) from public, anon, authenticated;
grant execute on function public.get_public_feed_author_profiles(uuid[]) to anon, authenticated;

revoke all on function public.student_registry_rate_limit_key() from public, anon, authenticated;
revoke all on function public.verify_student_registry(text) from public, anon, authenticated;
grant execute on function public.verify_student_registry(text) to anon, authenticated;
revoke all on function public.get_student_registry_row(text) from public, anon, authenticated;
grant execute on function public.get_student_registry_row(text) to anon, authenticated;

revoke all on function public.check_venue_availability(text, date, date, uuid) from public, anon, authenticated;
grant execute on function public.check_venue_availability(text, date, date, uuid) to authenticated;
revoke all on function public.check_venue_availability(text, date, date, uuid, time, time) from public, anon, authenticated;
grant execute on function public.check_venue_availability(text, date, date, uuid, time, time) to authenticated;

revoke all on function public.is_event_schedule_completed(date, date, time, time) from public, anon, authenticated;
revoke all on function public.submit_public_event_feedback(uuid, smallint, text, text[], uuid, text) from public, anon, authenticated;
grant execute on function public.submit_public_event_feedback(uuid, smallint, text, text[], uuid, text) to anon, authenticated;
revoke all on function public.verify_feedback_access_code(uuid, text) from public, anon, authenticated;
grant execute on function public.verify_feedback_access_code(uuid, text) to service_role;

revoke all on function public.admin_list_portal_users() from public, anon, authenticated;
grant execute on function public.admin_list_portal_users() to authenticated;
revoke all on function public.admin_list_portal_users_page(text, public.app_role, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_list_portal_users_page(text, public.app_role, integer, integer) to authenticated;
revoke all on function public.office_resource_analytics(text) from public, anon, authenticated;
grant execute on function public.office_resource_analytics(text) to authenticated;

revoke all on function public.check_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, text, integer, integer) to anon, authenticated;

comment on function public.get_public_feed_author_profiles(uuid[]) is
  'Public-safe feed author projection. Returns display fields only for users who authored a feed post.';
comment on function public.check_rate_limit(text, text, integer, integer) is
  'Fixed action-based limits; compatibility threshold arguments are ignored.';
