-- Reverts 20261005000100 through 20261005000400 (email switches, reviewer
-- notifications, email templates, delivery summary). Claim functions return to
-- their 20260909000300 definitions. Notifications already created are kept.

drop trigger if exists notify_next_workflow_reviewer on public.event_request_history;
drop function if exists public.notify_next_workflow_reviewer();

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

revoke all on function public.claim_notification_email_delivery(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.claim_notification_email_batch(integer)
  from public, anon, authenticated;
grant execute on function public.claim_notification_email_delivery(uuid, uuid)
  to service_role;
grant execute on function public.claim_notification_email_batch(integer)
  to service_role;

drop function if exists public.notification_email_outbox_summary();
drop function if exists public.notification_email_content(uuid);
drop function if exists public.notification_email_allowed(text);

drop trigger if exists notifications_set_event_type on public.notifications;
drop function if exists public.notifications_set_event_type();
alter table public.notifications drop column if exists event_type;

alter table public.app_settings
  drop constraint if exists app_settings_public_app_url_check;
alter table public.app_settings
  drop column if exists email_notifications_enabled,
  drop column if exists email_new_request,
  drop column if exists email_approval,
  drop column if exists email_decline,
  drop column if exists email_revision,
  drop column if exists email_resource_request,
  drop column if exists email_resource_decision,
  drop column if exists email_scheduled,
  drop column if exists public_app_url;
