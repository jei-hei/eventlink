-- Deprecate app_role value `student` (enum value retained; do not assign in new signups).
-- public.students table is retained for enrollment registry — not dropped in this pass.

comment on type public.app_role is
  'Portal roles. Value `student` is deprecated — public event viewing no longer requires an account.';

-- ---------------------------------------------------------------------------
-- Auth triggers: do not auto-assign student role
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
  meta_role text;
begin
  sid := upper(trim(coalesce(new.raw_user_meta_data ->> 'student_id', '')));
  sname := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );

  insert into public.profiles (id, display_name, email, student_id)
  values (
    new.id,
    sname,
    new.email,
    case when sid = '' then null else sid end
  );

  meta_role := nullif(trim(coalesce(new.raw_user_meta_data ->> 'role', '')), '');
  if meta_role is not null and meta_role <> 'student' then
    begin
      insert into public.user_roles (user_id, role)
      values (new.id, meta_role::public.app_role)
      on conflict (user_id) do nothing;
    exception
      when invalid_text_representation then
        null;
    end;
  end if;

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
  meta_role text;
begin
  if uid is null then
    return;
  end if;

  if exists (select 1 from public.profiles p where p.id = uid) then
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
    au.raw_user_meta_data ->> 'full_name',
    nullif(trim(coalesce(au.raw_user_meta_data ->> 'display_name', '')), ''),
    split_part(coalesce(au.email, ''), '@', 1)
  );

  insert into public.profiles (id, display_name, email, student_id)
  values (
    uid,
    coalesce(nullif(trim(sname), ''), 'User'),
    au.email,
    case when sid = '' then null else sid end
  )
  on conflict (id) do nothing;

  meta_role := nullif(trim(coalesce(au.raw_user_meta_data ->> 'role', '')), '');
  if meta_role is not null and meta_role <> 'student' then
    begin
      insert into public.user_roles (user_id, role)
      values (uid, meta_role::public.app_role)
      on conflict (user_id) do nothing;
    exception
      when invalid_text_representation then
        null;
    end;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Anonymous / public event feedback (no auth.uid required)
-- ---------------------------------------------------------------------------
create or replace function public.is_event_schedule_completed(
  p_start_date date,
  p_end_date date,
  p_start_time time,
  p_end_time time
)
returns boolean
language sql
stable
set search_path = public
as $$
  select now() > (
    coalesce(p_end_date, p_start_date)::timestamp
    + coalesce(p_end_time, time '23:59:59')
  );
$$;

create or replace function public.submit_public_event_feedback(
  p_feed_post_id uuid,
  p_rating smallint,
  p_comment text,
  p_improvement_tags text[] default '{}',
  p_request_id uuid default null,
  p_access_code_hash text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  post record;
  linked record;
  new_id uuid;
  clean_comment text;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Please select a rating from 1 to 5 stars.';
  end if;

  clean_comment := nullif(trim(coalesce(p_comment, '')), '');
  if clean_comment is null then
    raise exception 'Please choose a comment.';
  end if;

  select
    p.id,
    p.request_id,
    p.require_feedback_access_code,
    p.feedback_access_code_hash
  into post
  from public.student_feed_posts p
  where p.id = p_feed_post_id;

  if not found then
    raise exception 'This post was not found.';
  end if;

  if post.request_id is null then
    raise exception 'Feedback is not available for this post because it is not linked to a completed event.';
  end if;

  select r.start_date, r.end_date, r.start_time, r.end_time
  into linked
  from public.event_requests r
  where r.id = post.request_id;

  if not found then
    raise exception 'Linked event was not found.';
  end if;

  if not public.is_event_schedule_completed(
    linked.start_date,
    linked.end_date,
    linked.start_time,
    linked.end_time
  ) then
    raise exception 'Feedback opens after the linked event has finished.';
  end if;

  if post.require_feedback_access_code then
    if p_access_code_hash is null or p_access_code_hash = '' then
      raise exception 'Enter the feedback access code provided by the event organizer.';
    end if;
    if post.feedback_access_code_hash is distinct from p_access_code_hash then
      raise exception 'Incorrect access code. Feedback was not submitted.';
    end if;
  end if;

  insert into public.event_feedback (
    feed_post_id,
    request_id,
    rating,
    comment,
    improvement_tags
  )
  values (
    p_feed_post_id,
    coalesce(p_request_id, post.request_id),
    p_rating,
    clean_comment,
    coalesce(p_improvement_tags, '{}'::text[])
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.submit_public_event_feedback(uuid, smallint, text, text[], uuid, text) to anon;
grant execute on function public.submit_public_event_feedback(uuid, smallint, text, text[], uuid, text) to authenticated;

comment on function public.submit_public_event_feedback(uuid, smallint, text, text[], uuid, text) is
  'Validates completed event + optional access code, then inserts anonymous feedback without auth.uid().';
