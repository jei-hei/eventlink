-- Admin-controlled email notification switches on the existing app_settings row,
-- a stored application URL for email links, and claim-time enforcement in the
-- existing outbox claim functions. In-app notifications are not affected.

-- ---------------------------------------------------------------------------
-- Settings columns (Admin-only RLS on app_settings already covers new columns).
-- ---------------------------------------------------------------------------
alter table public.app_settings
  add column if not exists email_notifications_enabled boolean not null default true,
  add column if not exists email_new_request boolean not null default true,
  add column if not exists email_approval boolean not null default true,
  add column if not exists email_decline boolean not null default true,
  add column if not exists email_revision boolean not null default true,
  add column if not exists email_resource_request boolean not null default true,
  add column if not exists email_resource_decision boolean not null default true,
  add column if not exists email_scheduled boolean not null default true,
  add column if not exists public_app_url text not null default 'https://eventlinks.vercel.app';

alter table public.app_settings
  drop constraint if exists app_settings_public_app_url_check;
alter table public.app_settings
  add constraint app_settings_public_app_url_check
  check (public_app_url ~ '^https://[^\s/?#]+(/[^\s?#]*)?$' and length(public_app_url) <= 200);

comment on column public.app_settings.email_notifications_enabled is
  'Master switch for notification emails. In-app notifications are always created.';
comment on column public.app_settings.public_app_url is
  'Base URL used for links inside notification emails. Never contains tokens.';

-- ---------------------------------------------------------------------------
-- Notification event type, derived from the existing dedup key prefix
-- (enqueue_notification always stores "<event_type>:<key>").
-- ---------------------------------------------------------------------------
alter table public.notifications
  add column if not exists event_type text;

update public.notifications
set event_type = split_part(dedup_key, ':', 1)
where event_type is null
  and dedup_key is not null;

create or replace function public.notifications_set_event_type()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.event_type is null and new.dedup_key is not null then
    new.event_type := split_part(new.dedup_key, ':', 1);
  end if;
  return new;
end;
$$;

revoke all on function public.notifications_set_event_type() from public, anon, authenticated;

drop trigger if exists notifications_set_event_type on public.notifications;
create trigger notifications_set_event_type
before insert on public.notifications
for each row execute function public.notifications_set_event_type();

-- ---------------------------------------------------------------------------
-- Setting lookup used only inside security-definer delivery functions.
-- Event types without a dedicated toggle follow the master switch only.
-- ---------------------------------------------------------------------------
create or replace function public.notification_email_allowed(p_event_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select s.email_notifications_enabled
        and case lower(coalesce(p_event_type, ''))
          when 'request_submitted' then s.email_new_request
          when 'request_resubmitted' then s.email_new_request
          when 'review_required' then s.email_new_request
          when 'request_approved' then s.email_approval
          when 'sent_to_resource_offices' then s.email_approval
          when 'request_declined' then s.email_decline
          when 'revision_requested' then s.email_revision
          when 'resource_review_required' then s.email_resource_request
          when 'resource_declined' then s.email_resource_decision
          when 'event_scheduled' then s.email_scheduled
          else true
        end
      from public.app_settings s
      where s.id = 1
    ),
    true
  );
$$;

revoke all on function public.notification_email_allowed(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Existing claim functions: same signatures and grants. Added rules:
--   * skip when the Admin setting disables this email type
--   * skip notifications older than 72 hours so a backlog queued while the
--     provider was unconfigured is not sent days later
-- Skipped rows are terminal, so turning a setting back on never floods old mail.
-- ---------------------------------------------------------------------------
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

  select n.id, n.user_id, n.actor_id, n.title, n.body, n.event_type, n.created_at,
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
     or nullif(trim(coalesce(v_row.email, '')), '') is null
     or not public.notification_email_allowed(v_row.event_type)
     or v_row.created_at < now() - interval '72 hours' then
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
      or not public.notification_email_allowed(n.event_type)
      or n.created_at < now() - interval '72 hours'
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
      and public.notification_email_allowed(n.event_type)
      and n.created_at >= now() - interval '72 hours'
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

revoke all on function public.claim_notification_email_delivery(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.claim_notification_email_batch(integer)
  from public, anon, authenticated;
grant execute on function public.claim_notification_email_delivery(uuid, uuid)
  to service_role;
grant execute on function public.claim_notification_email_batch(integer)
  to service_role;
