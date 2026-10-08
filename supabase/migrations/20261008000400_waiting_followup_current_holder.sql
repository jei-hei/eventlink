-- After 24 hours, remind the person who currently holds the letter to take action.

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
  v_role public.app_role;
  v_org uuid;
  v_college uuid;
  v_request record;
  v_since timestamptz;
  v_place text;
  v_title text := 'Letter waiting for your action';
  v_body text;
  v_dedup text;
  v_id uuid;
begin
  if v_actor is null then
    return;
  end if;

  v_role := public.get_user_role(v_actor);
  if v_role is null or v_role not in (
    'adviser', 'dean', 'osas', 'eo', 'gso', 'it_infrastructure', 'sports_office', 'ssc'
  ) then
    return;
  end if;

  select p.organization_id, p.college_id
  into v_org, v_college
  from public.profiles p
  where p.id = v_actor;

  v_place := case v_role
    when 'adviser' then 'the Adviser'
    when 'dean' then 'the Dean'
    when 'osas' then 'OSAS'
    when 'eo' then 'the Executive Officer'
    when 'gso' then 'GSO'
    when 'it_infrastructure' then 'IT Infrastructure'
    when 'sports_office' then 'Sports Office'
    when 'ssc' then 'SSC'
  end;

  for v_request in
    select r.id, r.activity, r.current_step
    from public.event_requests r
    left join public.organizations o on o.id = r.organization_id
    where r.deleted_at is null
      and r.status = 'pending'
      and case v_role
        when 'adviser' then r.current_step = 'adviser'
          and v_org is not null
          and r.organization_id = v_org
        when 'dean' then r.current_step = 'dean'
          and v_college is not null
          and o.college_id = v_college
        when 'osas' then r.current_step = 'osas'
        when 'eo' then r.current_step = 'eo_schedule'
        when 'gso' then r.current_step = 'resource_offices'
          and exists (
            select 1 from public.event_request_resource_assignments a
            where a.request_id = r.id
              and a.status = 'pending'
              and a.assigned_office = 'gso'
          )
        when 'it_infrastructure' then r.current_step = 'resource_offices'
          and exists (
            select 1 from public.event_request_resource_assignments a
            where a.request_id = r.id
              and a.status = 'pending'
              and a.assigned_office = 'it_infrastructure'
          )
        when 'sports_office' then r.current_step = 'resource_offices'
          and exists (
            select 1 from public.event_request_resource_assignments a
            where a.request_id = r.id
              and a.status = 'pending'
              and a.assigned_office = 'sports_office'
          )
        when 'ssc' then r.current_step = 'resource_offices'
          and exists (
            select 1 from public.event_request_resource_assignments a
            where a.request_id = r.id
              and a.status = 'pending'
              and a.assigned_office = 'ssc'
          )
        else false
      end
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

    v_body := format(
      '"%s" is currently with %s. Please take action. It has been waiting for 24 hours.',
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
