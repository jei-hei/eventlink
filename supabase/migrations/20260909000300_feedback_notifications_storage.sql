-- Server-authoritative public feedback, notification outbox, and storage hardening.

-- ---------------------------------------------------------------------------
-- Feedback must always be linked to the request owned by its feed post.
-- ---------------------------------------------------------------------------
update public.event_feedback f
set request_id = p.request_id
from public.student_feed_posts p
where f.feed_post_id = p.id
  and p.request_id is not null
  and f.request_id is distinct from p.request_id;

-- Preserve unresolved historical rows verbatim for audit/recovery. They remain in
-- event_feedback; this locked archive records why they could not be normalized.
create table if not exists public.event_feedback_legacy_archive (
  source_feedback_id uuid primary key references public.event_feedback(id) on delete restrict,
  original_request_id uuid,
  original_feed_post_id uuid,
  archive_reason text not null,
  row_snapshot jsonb not null,
  archived_at timestamptz not null default now()
);

alter table public.event_feedback_legacy_archive enable row level security;
revoke all on table public.event_feedback_legacy_archive from public, anon, authenticated;

insert into public.event_feedback_legacy_archive (
  source_feedback_id,
  original_request_id,
  original_feed_post_id,
  archive_reason,
  row_snapshot
)
select
  f.id,
  f.request_id,
  f.feed_post_id,
  case
    when f.feed_post_id is null and f.request_id is null then 'missing_feed_post_and_request'
    when f.feed_post_id is null then 'missing_feed_post'
    when f.request_id is null then 'missing_request'
    when p.id is null then 'feed_post_not_found'
    when p.request_id is null then 'feed_post_has_no_request'
    else 'request_mismatch'
  end,
  to_jsonb(f)
from public.event_feedback f
left join public.student_feed_posts p on p.id = f.feed_post_id
where f.feed_post_id is null
   or f.request_id is null
   or p.id is null
   or p.request_id is null
   or f.request_id is distinct from p.request_id
on conflict (source_feedback_id) do nothing;

alter table public.event_feedback
  alter column request_id drop not null,
  alter column feed_post_id drop not null,
  drop constraint if exists event_feedback_has_target;

drop policy if exists event_feedback_insert_public on public.event_feedback;
drop policy if exists event_feedback_insert_authenticated on public.event_feedback;
drop policy if exists event_feedback_update_post_owner on public.event_feedback;
revoke insert on table public.event_feedback from anon, authenticated;
revoke update on table public.event_feedback from anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'student_feed_posts_id_request_id_key'
      and conrelid = 'public.student_feed_posts'::regclass
  ) then
    alter table public.student_feed_posts
      add constraint student_feed_posts_id_request_id_key unique (id, request_id);
  end if;
end;
$$;

alter table public.event_feedback
  drop constraint if exists event_feedback_feed_post_id_fkey,
  drop constraint if exists event_feedback_feed_post_request_fkey;

alter table public.event_feedback
  add constraint event_feedback_feed_post_request_fkey
  foreign key (feed_post_id, request_id)
  references public.student_feed_posts (id, request_id)
  on update restrict
  on delete set null (feed_post_id)
  not valid;

create or replace function public.enforce_event_feedback_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
begin
  if new.feed_post_id is null or new.request_id is null then
    if tg_op = 'INSERT' then
      raise exception 'New feedback requires matching feed-post and request linkage.';
    end if;
    if new.feed_post_id is null
       and old.feed_post_id is not null
       and new.request_id is not distinct from old.request_id then
      insert into public.event_feedback_legacy_archive (
        source_feedback_id,
        original_request_id,
        original_feed_post_id,
        archive_reason,
        row_snapshot
      )
      values (
        old.id,
        old.request_id,
        old.feed_post_id,
        'feed_post_deleted',
        to_jsonb(old)
      )
      on conflict (source_feedback_id) do nothing;
      return new;
    end if;
    if new.feed_post_id is distinct from old.feed_post_id
       or new.request_id is distinct from old.request_id then
      raise exception 'Legacy feedback linkage cannot be changed.';
    end if;
    return new;
  end if;

  select p.request_id into v_request_id
  from public.student_feed_posts p
  where p.id = new.feed_post_id;

  if not found or v_request_id is null then
    raise exception 'Feedback requires a feed post linked to an event request.';
  end if;
  if new.request_id is distinct from v_request_id then
    raise exception 'Feedback request does not match its feed post.';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_event_feedback_target()
  from public, anon, authenticated;

drop trigger if exists enforce_event_feedback_target on public.event_feedback;
create trigger enforce_event_feedback_target
before insert or update of feed_post_id, request_id on public.event_feedback
for each row execute function public.enforce_event_feedback_target();

-- The old RPC accepted a caller-provided request id. Keep its signature unavailable
-- so stale clients fail closed.
revoke all on function public.submit_public_event_feedback(uuid, smallint, text, text[], uuid, text)
  from public, anon, authenticated;
revoke all on function public.verify_feedback_access_code(uuid, text)
  from public, anon, authenticated;

create or replace function public.consume_server_rate_limit(
  p_action text,
  p_bucket_key text,
  p_max_attempts integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_started timestamptz;
  v_now timestamptz := clock_timestamp();
begin
  if nullif(trim(coalesce(p_action, '')), '') is null
     or nullif(trim(coalesce(p_bucket_key, '')), '') is null then
    return false;
  end if;

  insert into public.rate_limit_buckets (
    bucket_key, action, window_started_at, attempt_count, updated_at
  )
  values (left(p_bucket_key, 256), left(p_action, 64), v_now, 1, v_now)
  on conflict (bucket_key, action) do update
  set window_started_at = case
        when rate_limit_buckets.window_started_at <
             v_now - make_interval(secs => p_window_seconds)
          then v_now
        else rate_limit_buckets.window_started_at
      end,
      attempt_count = case
        when rate_limit_buckets.window_started_at <
             v_now - make_interval(secs => p_window_seconds)
          then 1
        else rate_limit_buckets.attempt_count + 1
      end,
      updated_at = v_now
  returning attempt_count, window_started_at into v_count, v_started;

  return v_count <= p_max_attempts;
end;
$$;

revoke all on function public.consume_server_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;

create or replace function public.verify_public_feedback_access_server(
  p_feed_post_id uuid,
  p_access_code_hash text,
  p_rate_limit_key text
)
returns table (
  post_exists boolean,
  requires_code boolean,
  verified boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post record;
begin
  if not public.consume_server_rate_limit(
    'feedback_verify',
    p_rate_limit_key || ':' || coalesce(p_feed_post_id::text, '-'),
    8,
    900
  ) then
    raise exception using errcode = 'P0001', message = 'rate_limit_exceeded';
  end if;

  select p.require_feedback_access_code, p.feedback_access_code_hash
  into v_post
  from public.student_feed_posts p
  where p.id = p_feed_post_id
    and p.request_id is not null;

  if not found then
    return query select false, false, false;
    return;
  end if;

  return query
  select
    true,
    v_post.require_feedback_access_code,
    (
      not v_post.require_feedback_access_code
      or (
        nullif(p_access_code_hash, '') is not null
        and v_post.feedback_access_code_hash = p_access_code_hash
      )
    );
end;
$$;

revoke all on function public.verify_public_feedback_access_server(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.verify_public_feedback_access_server(uuid, text, text)
  to service_role;

create or replace function public.submit_public_event_feedback_server(
  p_feed_post_id uuid,
  p_rating smallint,
  p_comment text,
  p_improvement_tags text[],
  p_access_code_hash text,
  p_rate_limit_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post record;
  v_request record;
  v_id uuid;
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
  v_tags text[];
begin
  if not public.consume_server_rate_limit(
    'feedback_submit',
    p_rate_limit_key || ':' || coalesce(p_feed_post_id::text, '-'),
    5,
    3600
  ) then
    raise exception using errcode = 'P0001', message = 'rate_limit_exceeded';
  end if;

  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'Please select a rating from 1 to 5 stars.';
  end if;
  if v_comment is null or length(v_comment) > 1000 then
    raise exception 'Please choose a comment of at most 1000 characters.';
  end if;

  select p.request_id, p.require_feedback_access_code, p.feedback_access_code_hash
  into v_post
  from public.student_feed_posts p
  where p.id = p_feed_post_id
  for share;

  if not found or v_post.request_id is null then
    raise exception 'Feedback is not available for this event.';
  end if;

  select r.start_date, r.end_date, r.start_time, r.end_time
  into v_request
  from public.event_requests r
  where r.id = v_post.request_id
    and r.deleted_at is null;

  if not found then
    raise exception 'Feedback is not available for this event.';
  end if;
  if not public.is_event_schedule_completed(
    v_request.start_date,
    v_request.end_date,
    v_request.start_time,
    v_request.end_time
  ) then
    raise exception 'Feedback opens after the linked event has finished.';
  end if;
  if v_post.require_feedback_access_code
     and (
       nullif(p_access_code_hash, '') is null
       or v_post.feedback_access_code_hash is distinct from p_access_code_hash
     ) then
    raise exception 'Incorrect access code. Feedback was not submitted.';
  end if;

  select coalesce(array_agg(tag), '{}'::text[])
  into v_tags
  from (
    select distinct left(trim(value), 80) as tag
    from unnest(coalesce(p_improvement_tags, '{}'::text[])) value
    where nullif(trim(value), '') is not null
    limit 20
  ) clean;

  insert into public.event_feedback (
    feed_post_id, request_id, rating, comment, improvement_tags
  )
  values (
    p_feed_post_id, v_post.request_id, p_rating, v_comment, v_tags
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_public_event_feedback_server(uuid, smallint, text, text[], text, text)
  from public, anon, authenticated;
grant execute on function public.submit_public_event_feedback_server(uuid, smallint, text, text[], text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Authorized notification enqueue + email outbox.
-- ---------------------------------------------------------------------------
alter table public.notifications
  add column if not exists request_id uuid references public.event_requests(id) on delete set null,
  add column if not exists actor_id uuid references auth.users(id) on delete set null,
  add column if not exists dedup_key text;

create unique index if not exists notifications_user_dedup_idx
  on public.notifications (user_id, dedup_key)
  where dedup_key is not null;

drop policy if exists notifications_own on public.notifications;
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete, truncate, references, trigger
  on table public.notifications from public, anon, authenticated;

create table if not exists public.notification_email_outbox (
  notification_id uuid primary key references public.notifications(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempt_count smallint not null default 0 check (attempt_count between 0 and 5),
  last_error text,
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_email_outbox enable row level security;
revoke all on table public.notification_email_outbox from public, anon, authenticated;

create or replace function public.can_enqueue_request_notification(
  p_request_id uuid,
  p_recipient_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.event_requests r
    where r.id = p_request_id
      and public.can_view_event_request_audit(r.id)
      and (
        p_recipient_id = r.submitted_by
        or public.has_role(p_recipient_id, 'admin')
        or (
          public.has_role(auth.uid(), 'eo')
          and exists (
            select 1
            from public.user_roles ur
            where ur.user_id = p_recipient_id
              and (
                ur.role::text in ('adviser', 'dean', 'osas', 'eo', 'gso')
                or exists (
                  select 1
                  from public.event_request_resource_assignments a
                  where a.request_id = r.id
                    and a.assigned_office::text = ur.role::text
                )
              )
          )
        )
      )
  );
$$;

revoke all on function public.can_enqueue_request_notification(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.enqueue_notification(
  p_user_id uuid,
  p_event_type text,
  p_request_id uuid default null,
  p_dedup_key text default null,
  p_context jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_event_type text := lower(trim(coalesce(p_event_type, '')));
  v_dedup text;
  v_title text;
  v_body text;
  v_category text;
  v_request record;
  v_schedule text;
  v_detail text := '';
  v_device text := left(trim(coalesce(p_context ->> 'device', 'Unknown device')), 160);
  v_ip text := left(trim(coalesce(p_context ->> 'ip', 'Unknown')), 80);
  v_location text := left(trim(coalesce(p_context ->> 'location', 'Unknown')), 160);
  v_time text := left(trim(coalesce(p_context ->> 'time', 'Unknown')), 80);
begin
  if auth.uid() is null then
    raise exception 'Unauthorized.';
  end if;
  if not public.consume_server_rate_limit(
    'notification_enqueue',
    auth.uid()::text,
    60,
    60
  ) then
    raise exception 'Too many notifications. Please try again later.';
  end if;
  if jsonb_typeof(coalesce(p_context, '{}'::jsonb)) <> 'object'
     or length(coalesce(p_context, '{}'::jsonb)::text) > 2000
     or coalesce(p_context, '{}'::jsonb)
          - array['detail', 'device', 'ip', 'location', 'time']::text[] <> '{}'::jsonb then
    raise exception 'Invalid notification context.';
  end if;

  if v_event_type = 'login_detected' then
    if p_user_id <> auth.uid() or p_request_id is not null then
      raise exception 'Not authorized to enqueue this notification.';
    end if;
    v_title := 'New login detected';
    v_category := 'security';
    v_body := format(
      E'Device: %s\nIP: %s\nLocation: %s\nTime: %s\nIf this wasn''t you, use "This wasn''t me" in Notifications.',
      v_device, v_ip, v_location, v_time
    );
  else
    if v_event_type not in (
      'request_submitted',
      'request_approved',
      'sent_to_resource_offices',
      'resource_review_required',
      'event_scheduled',
      'resource_declined',
      'request_declined',
      'published_student_feed',
      'published_staff_calendar',
      'event_cancelled',
      'revision_requested',
      'schedule_updated',
      'request_resubmitted'
    ) then
      raise exception 'Unsupported notification event type.';
    end if;
    if p_request_id is null
       or not public.can_enqueue_request_notification(p_request_id, p_user_id) then
      raise exception 'Not authorized to enqueue this request notification.';
    end if;

    select
      r.activity,
      r.start_date,
      r.end_date,
      r.start_time,
      r.end_time,
      r.venue
    into v_request
    from public.event_requests r
    where r.id = p_request_id;

    if not found then
      raise exception 'Event request not found.';
    end if;

    if not exists (
      select 1
      from public.event_request_history h
      where h.request_id = p_request_id
        and (
          (v_event_type = 'request_submitted' and h.action in ('submitted', 'created'))
          or (v_event_type = 'request_approved' and h.action = 'approved')
          or (
            v_event_type in ('sent_to_resource_offices', 'resource_review_required')
            and h.action in ('venue_assigned', 'equipment_assigned')
          )
          or (v_event_type = 'event_scheduled' and h.action = 'scheduled')
          or (
            v_event_type = 'resource_declined'
            and h.action in ('venue_declined', 'equipment_declined')
          )
          or (v_event_type = 'request_declined' and h.action = 'declined')
          or (v_event_type = 'published_student_feed' and h.action = 'posted')
          or (v_event_type = 'published_staff_calendar' and h.action = 'calendar_posted')
          or (v_event_type = 'event_cancelled' and h.action = 'cancelled')
          or (v_event_type = 'revision_requested' and h.action = 'revision_requested')
          or (v_event_type = 'schedule_updated' and h.action = 'updated')
          or (v_event_type = 'request_resubmitted' and h.action = 'resubmitted')
        )
    ) then
      raise exception 'Notification event has not occurred.';
    end if;

    select left(trim(coalesce(h.comment, '')), 240)
    into v_detail
    from public.event_request_history h
    where h.request_id = p_request_id
      and (
        (v_event_type = 'request_approved' and h.action = 'approved')
        or (v_event_type = 'resource_declined' and h.action in ('venue_declined', 'equipment_declined'))
        or (v_event_type = 'request_declined' and h.action = 'declined')
        or (v_event_type = 'event_cancelled' and h.action = 'cancelled')
        or (v_event_type = 'revision_requested' and h.action = 'revision_requested')
        or (v_event_type = 'schedule_updated' and h.action = 'updated')
      )
    order by h.created_at desc
    limit 1;
    v_detail := coalesce(v_detail, '');

    v_schedule := format(
      '%s to %s, %s-%s at %s',
      v_request.start_date,
      v_request.end_date,
      left(coalesce(v_request.start_time::text, 'TBA'), 5),
      left(coalesce(v_request.end_time::text, 'TBA'), 5),
      coalesce(nullif(trim(v_request.venue), ''), 'TBA')
    );

    select title, category, body
    into v_title, v_category, v_body
    from (
      values
        ('request_submitted', 'Request submitted', 'approval',
          format('"%s" was submitted (%s).', v_request.activity, v_schedule)),
        ('request_approved', 'Request approved', 'approval',
          format('"%s" was approved. %s%s', v_request.activity, v_schedule,
            case when v_detail = '' then '' else ' ' || v_detail end)),
        ('sent_to_resource_offices', 'Sent to resource offices', 'approval',
          format('"%s" was forwarded to resource offices. %s%s', v_request.activity, v_schedule,
            case when v_detail = '' then '' else ' ' || v_detail end)),
        ('resource_review_required', 'Resource review required', 'approval',
          format('"%s" requires resource review. %s%s', v_request.activity, v_schedule,
            case when v_detail = '' then '' else ' ' || v_detail end)),
        ('event_scheduled', 'Event scheduled', 'calendar',
          format('"%s" is scheduled on the staff calendar. %s', v_request.activity, v_schedule)),
        ('resource_declined', 'Request declined by resource office', 'approval',
          format('"%s" was declined by a resource office. %s%s', v_request.activity, v_schedule,
            case when v_detail = '' then '' else ' ' || v_detail end)),
        ('request_declined', 'Request declined', 'approval',
          format('"%s" was declined. %s%s', v_request.activity, v_schedule,
            case when v_detail = '' then '' else ' ' || v_detail end)),
        ('published_student_feed', 'Published to student feed', 'system',
          format('"%s" is now live on the student dashboard. %s', v_request.activity, v_schedule)),
        ('published_staff_calendar', 'Published to staff calendar', 'calendar',
          format('"%s" was posted to the staff schedule calendar. %s', v_request.activity, v_schedule)),
        ('event_cancelled', 'Event cancelled', 'system',
          format('"%s" was cancelled. %s%s', v_request.activity, v_schedule,
            case when v_detail = '' then '' else ' ' || v_detail end)),
        ('revision_requested', 'Revision requested for your event request', 'approval',
          format('Revision was requested for "%s". %s%s', v_request.activity, v_schedule,
            case when v_detail = '' then '' else ' ' || v_detail end)),
        ('schedule_updated', 'Event schedule updated', 'calendar',
          format('"%s" schedule was updated. %s%s', v_request.activity, v_schedule,
            case when v_detail = '' then '' else ' ' || v_detail end)),
        ('request_resubmitted', 'Event resubmitted successfully', 'approval',
          format('"%s" was resubmitted. %s', v_request.activity, v_schedule))
    ) templates(event_type, title, category, body)
    where event_type = v_event_type;
  end if;

  if nullif(trim(coalesce(p_dedup_key, '')), '') is null then
    raise exception 'A stable notification deduplication key is required.';
  end if;
  v_dedup := left(v_event_type || ':' || trim(p_dedup_key), 160);

  insert into public.notifications (
    user_id, title, body, category, request_id, actor_id, dedup_key
  )
  values (
    p_user_id, v_title, v_body, v_category, p_request_id, auth.uid(), v_dedup
  )
  on conflict (user_id, dedup_key) where dedup_key is not null
  do update set dedup_key = excluded.dedup_key
  returning id into v_id;

  insert into public.notification_email_outbox (notification_id)
  values (v_id)
  on conflict (notification_id) do nothing;

  return v_id;
end;
$$;

revoke all on function public.enqueue_notification(uuid, text, uuid, text, jsonb)
  from public, anon;
grant execute on function public.enqueue_notification(uuid, text, uuid, text, jsonb)
  to authenticated;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Unauthorized.' using errcode = '42501';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and user_id = auth.uid();

  return found;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized.' using errcode = '42501';
  end if;

  update public.notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public, anon;
revoke all on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

create or replace function public.claim_notification_email_delivery(
  p_notification_id uuid,
  p_initiator_id uuid
)
returns table (
  notification_id uuid,
  recipient_email text,
  email_subject text,
  email_text text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  if p_initiator_id is null
     or not public.consume_server_rate_limit(
       'notification_email',
       p_initiator_id::text,
       20,
       60
     ) then
    return;
  end if;

  select n.id, n.user_id, n.actor_id, n.title, n.body,
         u.email, u.email_confirmed_at, p.notify_email,
         o.status, o.attempt_count, o.next_attempt_at, o.claimed_at
  into v_row
  from public.notifications n
  join public.notification_email_outbox o on o.notification_id = n.id
  left join auth.users u on u.id = n.user_id
  left join public.profiles p on p.id = n.user_id
  where n.id = p_notification_id
  for update of o;

  if not found
     or p_initiator_id is null
     or p_initiator_id is distinct from v_row.actor_id
     or (
       v_row.status not in ('pending', 'failed')
       and not (
         v_row.status = 'sending'
         and v_row.claimed_at < now() - interval '5 minutes'
       )
     )
     or v_row.attempt_count >= 5
     or v_row.next_attempt_at > now() then
    return;
  end if;

  if not coalesce(v_row.notify_email, true)
     or v_row.email_confirmed_at is null
     or nullif(trim(coalesce(v_row.email, '')), '') is null then
    update public.notification_email_outbox
    set status = 'skipped', updated_at = now()
    where notification_id = p_notification_id;
    return;
  end if;

  update public.notification_email_outbox
  set status = 'sending',
      attempt_count = attempt_count + 1,
      claimed_at = now(),
      updated_at = now()
  where notification_id = p_notification_id;

  return query
  select v_row.id::uuid, v_row.email::text, v_row.title::text, v_row.body::text;
end;
$$;

create or replace function public.claim_notification_email_batch(p_limit integer default 25)
returns table (
  notification_id uuid,
  recipient_email text,
  email_subject text,
  email_text text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_email_outbox o
  set status = 'skipped',
      updated_at = now()
  from public.notifications n
  left join auth.users u on u.id = n.user_id
  left join public.profiles p on p.id = n.user_id
  where n.id = o.notification_id
    and o.attempt_count < 5
    and (
      (o.status in ('pending', 'failed') and o.next_attempt_at <= now())
      or (o.status = 'sending' and o.claimed_at < now() - interval '5 minutes')
    )
    and (
      not coalesce(p.notify_email, true)
      or u.email_confirmed_at is null
      or nullif(trim(coalesce(u.email, '')), '') is null
    );

  return query
  with candidates as (
    select o.notification_id, u.email, n.title, n.body
    from public.notification_email_outbox o
    join public.notifications n on n.id = o.notification_id
    join auth.users u
      on u.id = n.user_id
      and u.email_confirmed_at is not null
      and nullif(trim(coalesce(u.email, '')), '') is not null
    left join public.profiles p on p.id = n.user_id
    where coalesce(p.notify_email, true)
      and o.attempt_count < 5
      and (
        (o.status in ('pending', 'failed') and o.next_attempt_at <= now())
        or (o.status = 'sending' and o.claimed_at < now() - interval '5 minutes')
      )
    order by o.next_attempt_at, o.created_at
    for update of o skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  ),
  claimed as (
    update public.notification_email_outbox o
    set status = 'sending',
        attempt_count = attempt_count + 1,
        claimed_at = now(),
        updated_at = now()
    from candidates c
    where o.notification_id = c.notification_id
    returning c.notification_id, c.email, c.title, c.body
  )
  select c.notification_id, c.email::text, c.title::text, c.body::text
  from claimed c;
end;
$$;

create or replace function public.finish_notification_email_delivery(
  p_notification_id uuid,
  p_sent boolean,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_email_outbox o
  set status = case
        when p_sent then 'sent'
        when o.attempt_count >= 5 then 'exhausted'
        else 'failed'
      end,
      last_error = case
        when p_sent then null
        else left(coalesce(nullif(trim(p_error_code), ''), 'delivery_failed'), 80)
      end,
      next_attempt_at = case
        when p_sent then o.next_attempt_at
        else now() + make_interval(
          secs => least(3600, 30 * (2 ^ greatest(o.attempt_count - 1, 0))::integer)
        )
      end,
      sent_at = case when p_sent then now() else null end,
      updated_at = now()
  where o.notification_id = p_notification_id
    and o.status = 'sending';
end;
$$;

alter table public.notification_email_outbox
  drop constraint if exists notification_email_outbox_status_check;
alter table public.notification_email_outbox
  add constraint notification_email_outbox_status_check
  check (status in ('pending', 'sending', 'sent', 'failed', 'exhausted', 'skipped'));

revoke all on function public.claim_notification_email_delivery(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.claim_notification_email_batch(integer)
  from public, anon, authenticated;
revoke all on function public.finish_notification_email_delivery(uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.claim_notification_email_delivery(uuid, uuid)
  to service_role;
grant execute on function public.claim_notification_email_batch(integer)
  to service_role;
grant execute on function public.finish_notification_email_delivery(uuid, boolean, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Storage bucket and path restrictions. Bucket limits are authoritative.
-- ---------------------------------------------------------------------------
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf']::text[]
where id = 'event-letters';

update storage.buckets
set file_size_limit = 8388608,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
where id = 'event-post-images';

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
where id = 'profile-avatars';

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/png', 'image/jpeg', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]::text[]
where id = 'compliance-attachments';

create or replace function public.can_delete_event_letter_upload(p_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  v_parts text[];
  v_request_id uuid;
begin
  if auth.uid() is null or nullif(trim(coalesce(p_path, '')), '') is null then
    return false;
  end if;

  v_parts := storage.foldername(p_path);
  if coalesce(array_length(v_parts, 1), 0) <> 2
     or v_parts[1] <> auth.uid()::text
     or v_parts[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;
  v_request_id := v_parts[2]::uuid;

  if exists (
    select 1
    from public.event_request_letters l
    where l.letter_path = p_path
  ) or exists (
    select 1
    from public.event_requests r
    where r.id = v_request_id
      and p_path in (r.letter_path, r.original_letter_path)
  ) then
    return false;
  end if;

  return exists (
    select 1
    from public.event_request_upload_intents i
    where i.request_id = v_request_id
      and i.user_id = auth.uid()
  ) or not exists (
    select 1
    from public.event_requests r
    where r.id = v_request_id
  );
exception
  when invalid_text_representation then
    return false;
end;
$$;

revoke all on function public.can_delete_event_letter_upload(text) from public, anon;
grant execute on function public.can_delete_event_letter_upload(text) to authenticated;

drop policy if exists event_letters_delete_own on storage.objects;
drop policy if exists event_letters_delete_unsubmitted_own on storage.objects;
create policy event_letters_delete_unsubmitted_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'event-letters'
  and public.can_delete_event_letter_upload(name)
);

drop policy if exists event_letters_insert_authenticated on storage.objects;
create policy event_letters_insert_authenticated
on storage.objects for insert to authenticated
with check (
  bucket_id = 'event-letters'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (storage.foldername(name))[3] is null
  and lower(storage.extension(name)) = 'pdf'
  and public.has_event_request_upload_intent(((storage.foldername(name))[2])::uuid)
);

drop policy if exists event_letters_update_own on storage.objects;

drop policy if exists event_post_images_insert_own on storage.objects;
create policy event_post_images_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'event-post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (storage.foldername(name))[3] is null
  and exists (
    select 1 from public.event_requests r
    where r.id = ((storage.foldername(name))[2])::uuid
      and r.submitted_by = auth.uid()
  )
);

drop policy if exists event_post_images_update_own on storage.objects;
create policy event_post_images_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'event-post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'event-post-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (storage.foldername(name))[3] is null
  and exists (
    select 1 from public.event_requests r
    where r.id = ((storage.foldername(name))[2])::uuid
      and r.submitted_by = auth.uid()
  )
);

drop policy if exists profile_avatars_insert_own on storage.objects;
create policy profile_avatars_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] is null
);

drop policy if exists profile_avatars_update_own on storage.objects;
create policy profile_avatars_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] is null
);

drop policy if exists compliance_attachments_insert_authenticated on storage.objects;
create policy compliance_attachments_insert_authenticated
on storage.objects for insert to authenticated
with check (
  bucket_id = 'compliance-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (storage.foldername(name))[3] is null
  and public.can_view_event_request_audit(((storage.foldername(name))[2])::uuid)
);

drop policy if exists compliance_attachments_update_own on storage.objects;
create policy compliance_attachments_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'compliance-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'compliance-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (storage.foldername(name))[3] is null
  and public.can_view_event_request_audit(((storage.foldername(name))[2])::uuid)
);
