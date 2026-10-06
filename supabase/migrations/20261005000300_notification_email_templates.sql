-- Single email template for every notification email. Both delivery paths
-- (immediate send and outbox batch) receive the same subject and text from
-- the claim functions; Edge Functions only render the text as HTML.
-- The in-app notification title/body are unchanged.

create or replace function public.notification_email_content(p_notification_id uuid)
returns table (email_subject text, email_text text)
language sql
stable
security definer
set search_path = public
as $$
  select
    left('EventLink: ' || n.title, 160),
    concat_ws(
      E'\n\n',
      'Hello ' || coalesce(nullif(left(trim(p.display_name), 80), ''), 'there') || ',',
      left(n.body, 2000),
      'Open EventLink: '
        || rtrim(coalesce(s.public_app_url, 'https://eventlinks.vercel.app'), '/') || '/',
      E'This is an automated message from EventLink, Isabela State University. Please do not reply to this email.\n'
        || 'You can turn off email notifications anytime in your EventLink profile.'
    )
  from public.notifications n
  left join public.profiles p on p.id = n.user_id
  left join public.app_settings s on s.id = 1
  where n.id = p_notification_id;
$$;

revoke all on function public.notification_email_content(uuid) from public, anon, authenticated;

-- Same logic as 20261005000100; the returned subject/text now come from the template.
-- Outbox columns are alias-qualified because notification_id is also an output column.
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

  select n.id, n.user_id, n.actor_id, n.event_type, n.created_at,
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
    update public.notification_email_outbox o
    set status = 'skipped', updated_at = now()
    where o.notification_id = p_notification_id;
    return;
  end if;

  update public.notification_email_outbox o
  set status = 'sending',
      attempt_count = o.attempt_count + 1,
      claimed_at = now(),
      updated_at = now()
  where o.notification_id = p_notification_id;

  return query
  select v_row.id::uuid, v_row.email::text, c.email_subject, c.email_text
  from public.notification_email_content(v_row.id) c;
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
    select o.notification_id, u.email
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
    returning c.notification_id, c.email
  )
  select c.notification_id, c.email::text, t.email_subject, t.email_text
  from claimed c
  cross join lateral public.notification_email_content(c.notification_id) t;
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
