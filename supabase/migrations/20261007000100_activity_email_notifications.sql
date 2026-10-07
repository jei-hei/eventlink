-- Activity emails: next reviewer, selected offices, and the requester on
-- decline, revision, or schedule. Other in-app notifications stay in the bell.

create or replace function public.activity_email_allowed(p_dedup_key text)
returns boolean
language sql
immutable
as $$
  select split_part(coalesce(p_dedup_key, ''), ':', 1) in (
    'review_required',
    'resource_review_required',
    'request_declined',
    'resource_declined',
    'revision_requested',
    'event_scheduled'
  );
$$;

revoke all on function public.activity_email_allowed(text) from public, anon, authenticated;

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

  select n.id, n.user_id, n.actor_id, n.title, n.body, n.dedup_key,
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

  if not public.activity_email_allowed(v_row.dedup_key)
     or not coalesce(v_row.notify_email, true)
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
      not public.activity_email_allowed(n.dedup_key)
      or not coalesce(p.notify_email, true)
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
    where public.activity_email_allowed(n.dedup_key)
      and coalesce(p.notify_email, true)
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
grant execute on function public.claim_notification_email_delivery(uuid, uuid) to service_role;
grant execute on function public.claim_notification_email_batch(integer) to service_role;

-- Called by the person who just submitted, approved, or resubmitted.
-- Emails the users who now have to review that request.
create or replace function public.enqueue_current_step_review_notifications(p_request_id uuid)
returns setof uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_request record;
  v_step public.workflow_step;
  v_history_id uuid;
  v_label text;
  v_title text;
  v_body text;
  v_recipient uuid;
  v_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select r.id, r.activity, r.start_date, r.end_date, r.start_time, r.end_time, r.venue,
         r.status, r.current_step, r.request_type, r.organization_id, r.deleted_at,
         o.name as organization_name, o.college_id
  into v_request
  from public.event_requests r
  left join public.organizations o on o.id = r.organization_id
  where r.id = p_request_id;

  if not found or v_request.deleted_at is not null then
    return;
  end if;
  if v_request.status <> 'pending'
     or v_request.current_step not in ('adviser', 'dean', 'osas', 'eo_schedule') then
    return;
  end if;
  if not exists (
    select 1
    from public.event_request_history h
    where h.request_id = p_request_id
      and h.actor_id = v_actor
      and h.created_at > now() - interval '5 minutes'
  ) then
    raise exception 'Not authorized to notify reviewers for this request.' using errcode = '42501';
  end if;

  v_step := v_request.current_step;
  select h.id into v_history_id
  from public.event_request_history h
  where h.request_id = p_request_id
    and h.actor_id = v_actor
  order by h.created_at desc
  limit 1;

  v_label := case v_step
    when 'adviser' then 'Adviser'
    when 'dean' then 'Dean'
    when 'osas' then 'OSAS'
    when 'eo_schedule' then 'Executive Officer'
  end;
  v_title := 'Event request awaiting your review';
  v_body := format(
    '"%s" from %s is waiting for %s review. %s to %s, %s-%s at %s. Sign in to EventLink to review it.',
    v_request.activity,
    case
      when v_request.request_type = 'ssc' then 'SSC'
      else coalesce(nullif(trim(v_request.organization_name), ''), 'an organization')
    end,
    v_label,
    v_request.start_date,
    v_request.end_date,
    left(coalesce(v_request.start_time::text, 'TBA'), 5),
    left(coalesce(v_request.end_time::text, 'TBA'), 5),
    coalesce(nullif(trim(v_request.venue), ''), 'TBA')
  );

  for v_recipient in
    select ur.user_id
    from public.user_roles ur
    left join public.profiles p on p.id = ur.user_id
    where ur.user_id is distinct from v_actor
      and case v_step
        when 'adviser' then ur.role = 'adviser'
          and v_request.organization_id is not null
          and p.organization_id = v_request.organization_id
        when 'dean' then ur.role = 'dean'
          and v_request.college_id is not null
          and p.college_id = v_request.college_id
        when 'osas' then ur.role = 'osas'
        when 'eo_schedule' then ur.role = 'eo'
        else false
      end
    order by ur.user_id
    limit 20
  loop
    insert into public.notifications (
      user_id, title, body, category, request_id, actor_id, dedup_key
    ) values (
      v_recipient,
      v_title,
      v_body,
      'approval',
      p_request_id,
      v_actor,
      'review_required:' || p_request_id::text || ':' || v_step::text || ':' || v_history_id::text
    )
    on conflict (user_id, dedup_key) where dedup_key is not null do nothing
    returning id into v_id;

    if v_id is not null then
      insert into public.notification_email_outbox (notification_id)
      values (v_id)
      on conflict (notification_id) do nothing;
      return next v_id;
    end if;
    v_id := null;
  end loop;
end;
$$;

revoke all on function public.enqueue_current_step_review_notifications(uuid)
  from public, anon, authenticated;
grant execute on function public.enqueue_current_step_review_notifications(uuid) to authenticated;
