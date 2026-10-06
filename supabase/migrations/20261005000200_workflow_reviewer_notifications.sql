-- Notify the next approver when a request reaches their workflow step.
-- Runs inside the same transaction as the canonical workflow history insert,
-- so it cannot be lost when the browser tab closes. Routing is unchanged:
-- recipients are derived from the step the request is already on.
-- Failures are swallowed so the workflow never depends on notification delivery.

create or replace function public.notify_next_workflow_reviewer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_step public.workflow_step;
  v_request record;
  v_step_label text;
  v_title text;
  v_body text;
  v_recipient uuid;
  v_notification_id uuid;
begin
  if new.action not in ('submitted', 'approved', 'resubmitted') then
    return new;
  end if;

  begin
    v_step := case
      when new.action = 'approved' then nullif(new.metadata ->> 'next_step', '')::public.workflow_step
      else new.step
    end;
    if v_step is null or v_step not in ('adviser', 'dean', 'osas', 'eo_schedule', 'gso') then
      return new;
    end if;

    select r.activity, r.start_date, r.end_date, r.start_time, r.end_time, r.venue,
           r.status, r.current_step, r.request_type, r.organization_id,
           o.name as organization_name, o.college_id
    into v_request
    from public.event_requests r
    left join public.organizations o on o.id = r.organization_id
    where r.id = new.request_id
      and r.deleted_at is null;

    if not found
       or v_request.status <> 'pending'
       or v_request.current_step is distinct from v_step then
      return new;
    end if;

    v_step_label := case v_step
      when 'adviser' then 'Adviser'
      when 'dean' then 'Dean'
      when 'osas' then 'OSAS'
      when 'eo_schedule' then 'EO scheduling'
      when 'gso' then 'GSO'
    end;
    v_title := case
      when new.action = 'resubmitted' then 'Resubmitted request awaiting your review'
      else 'Event request awaiting your review'
    end;
    v_body := format(
      '"%s" from %s is waiting for %s review. %s to %s, %s-%s at %s.',
      v_request.activity,
      case
        when v_request.request_type = 'ssc' then 'SSC'
        else coalesce(nullif(trim(v_request.organization_name), ''), 'an organization')
      end,
      v_step_label,
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
      where ur.user_id is distinct from new.actor_id
        and case v_step
          when 'adviser' then ur.role = 'adviser'
            and v_request.organization_id is not null
            and p.organization_id = v_request.organization_id
          when 'dean' then ur.role = 'dean'
            and v_request.college_id is not null
            and p.college_id = v_request.college_id
          when 'osas' then ur.role = 'osas'
          when 'eo_schedule' then ur.role = 'eo'
          when 'gso' then ur.role = 'gso'
          else false
        end
      order by ur.user_id
      limit 50
    loop
      v_notification_id := null;

      insert into public.notifications (
        user_id, title, body, category, request_id, actor_id, dedup_key, event_type
      ) values (
        v_recipient, v_title, v_body, 'approval', new.request_id, new.actor_id,
        'review_required:' || new.id::text, 'review_required'
      )
      on conflict (user_id, dedup_key) where dedup_key is not null do nothing
      returning id into v_notification_id;

      if v_notification_id is not null then
        insert into public.notification_email_outbox (notification_id)
        values (v_notification_id)
        on conflict (notification_id) do nothing;
      end if;
    end loop;
  exception
    when others then
      raise warning 'Reviewer notification skipped for history %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function public.notify_next_workflow_reviewer() from public, anon, authenticated;

drop trigger if exists notify_next_workflow_reviewer on public.event_request_history;
create trigger notify_next_workflow_reviewer
after insert on public.event_request_history
for each row execute function public.notify_next_workflow_reviewer();
