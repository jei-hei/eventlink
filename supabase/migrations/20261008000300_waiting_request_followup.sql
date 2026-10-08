-- One follow-up to the requester after a request stays on the same step for 24 hours.

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
    'event_scheduled',
    'request_waiting'
  );
$$;

revoke all on function public.activity_email_allowed(text) from public, anon, authenticated;

create or replace function public.enqueue_waiting_request_followups()
returns table (
  id uuid,
  title text,
  body text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_request record;
  v_since timestamptz;
  v_place text;
  v_labels text[];
  v_title text := 'Request still waiting';
  v_body text;
  v_dedup text;
  v_id uuid;
begin
  if v_actor is null then
    return;
  end if;

  for v_request in
    select r.id, r.activity, r.current_step
    from public.event_requests r
    where r.submitted_by = v_actor
      and r.deleted_at is null
      and r.status = 'pending'
      and r.current_step in ('adviser', 'dean', 'osas', 'eo_schedule', 'resource_offices')
    order by r.updated_at
    limit 10
  loop
    select min(h.created_at) into v_since
    from public.event_request_history h
    where h.request_id = v_request.id
      and h.step = v_request.current_step
      and h.created_at >= coalesce((
        select max(earlier.created_at)
        from public.event_request_history earlier
        where earlier.request_id = v_request.id
          and earlier.step is distinct from v_request.current_step
      ), '-infinity'::timestamptz);

    if v_since is null or v_since > now() - interval '24 hours' then
      continue;
    end if;

    if v_request.current_step = 'resource_offices' then
      select coalesce(array_agg(office_label order by office_label), '{}')
      into v_labels
      from (
        select distinct case a.assigned_office
          when 'gso' then 'GSO'
          when 'it_infrastructure' then 'IT Infrastructure'
          when 'sports_office' then 'Sports Office'
          when 'ssc' then 'SSC'
          else a.assigned_office::text
        end as office_label
        from public.event_request_resource_assignments a
        where a.request_id = v_request.id
          and a.status = 'pending'
      ) offices;
      v_place := case
        when cardinality(v_labels) = 1 then v_labels[1]
        when cardinality(v_labels) = 2 then v_labels[1] || ' and ' || v_labels[2]
        when cardinality(v_labels) > 2 then
          array_to_string(v_labels[1:cardinality(v_labels) - 1], ', ')
          || ', and '
          || v_labels[cardinality(v_labels)]
        else 'the assigned offices'
      end;
    else
      v_place := case v_request.current_step
        when 'adviser' then 'the Adviser'
        when 'dean' then 'the Dean'
        when 'osas' then 'OSAS'
        when 'eo_schedule' then 'the Executive Officer'
      end;
    end if;

    v_body := format(
      '"%s" is still with %s. It has been waiting for 24 hours.',
      v_request.activity,
      v_place
    );
    v_dedup := 'request_waiting:' || v_request.id::text || ':' || v_request.current_step::text;

    insert into public.notifications (
      user_id, title, body, category, request_id, actor_id, dedup_key
    ) values (
      v_actor,
      v_title,
      v_body,
      'approval',
      v_request.id,
      v_actor,
      v_dedup
    )
    on conflict (user_id, dedup_key) where dedup_key is not null do nothing
    returning notifications.id, notifications.title, notifications.body
    into v_id, title, body;

    if v_id is not null then
      insert into public.notification_email_outbox (notification_id)
      values (v_id)
      on conflict (notification_id) do nothing;
      id := v_id;
      return next;
    end if;
    v_id := null;
  end loop;
end;
$$;

revoke all on function public.enqueue_waiting_request_followups()
  from public, anon, authenticated;
grant execute on function public.enqueue_waiting_request_followups() to authenticated;
