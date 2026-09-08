-- Event Log / Event Trail history is EO-only.
-- Letters and compliance comments keep can_view_event_request_audit (workflow still needs files).
-- Office analytics RPC: aggregate venue/equipment stats without dumping full event tables.

drop policy if exists event_request_history_select_authenticated on public.event_request_history;
create policy event_request_history_select_authenticated on public.event_request_history
  for select to authenticated
  using (public.has_role(auth.uid(), 'eo'));

comment on policy event_request_history_select_authenticated on public.event_request_history is
  'Event Log and Event Trail are Executive Officer only.';

create or replace function public.office_resource_analytics(p_office text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_office text := lower(trim(coalesce(p_office, '')));
  v_resource_office public.resource_office;
  result jsonb;
begin
  if v_office not in ('gso', 'sports_office', 'it_infrastructure') then
    raise exception 'invalid office';
  end if;
  if auth.uid() is null or not public.has_role(auth.uid(), v_office::public.app_role) then
    raise exception 'not authorized';
  end if;
  v_resource_office := v_office::public.resource_office;

  select jsonb_build_object(
    'venues', (
      select jsonb_build_object(
        'total', count(*)::int,
        'active', count(*) filter (where active)::int
      )
      from public.venues
      where responsible_office = v_resource_office
    ),
    'equipment', (
      select jsonb_build_object(
        'total', count(*)::int,
        'active', count(*) filter (where active)::int,
        'availableUnits', coalesce(
          sum(quantity_available) filter (
            where active
              and coalesce(availability, 'available') = 'available'
              and quantity_available > 0
          ),
          0
        )::int,
        'zeroStock', count(*) filter (where active and quantity_available <= 0)::int
      )
      from public.equipment
      where responsible_office = v_resource_office
    ),
    'venueUsage', (
      select coalesce(
        jsonb_agg(jsonb_build_object('name', x.name, 'count', x.cnt) order by x.cnt desc),
        '[]'::jsonb
      )
      from (
        select coalesce(nullif(trim(a.resource_name), ''), 'Unnamed venue') as name,
               count(*)::int as cnt
        from public.event_request_resource_assignments a
        join public.event_requests r on r.id = a.request_id
        where a.assigned_office = v_resource_office
          and a.resource_kind = 'venue'
          and r.deleted_at is null
        group by 1
        order by 2 desc
        limit 8
      ) x
    ),
    'equipmentUsage', (
      select coalesce(
        jsonb_agg(jsonb_build_object('name', x.name, 'count', x.cnt) order by x.cnt desc),
        '[]'::jsonb
      )
      from (
        select coalesce(nullif(trim(a.resource_name), ''), 'Unnamed equipment') as name,
               count(*)::int as cnt
        from public.event_request_resource_assignments a
        join public.event_requests r on r.id = a.request_id
        where a.assigned_office = v_resource_office
          and a.resource_kind = 'equipment'
          and r.deleted_at is null
        group by 1
        order by 2 desc
        limit 8
      ) x
    ),
    'events', (
      select jsonb_build_object(
        'assigned', count(distinct a.request_id)::int,
        'upcoming', count(distinct a.request_id) filter (
          where r.calendar_posted_at is not null
            and r.status <> 'cancelled'
            and r.start_date >= current_date
        )::int,
        'completed', count(distinct a.request_id) filter (
          where r.end_date < current_date
        )::int
      )
      from public.event_request_resource_assignments a
      join public.event_requests r on r.id = a.request_id
      where a.assigned_office = v_resource_office
        and r.deleted_at is null
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.office_resource_analytics(text) from public;
grant execute on function public.office_resource_analytics(text) to authenticated;

comment on function public.office_resource_analytics(text) is
  'Aggregated venue/equipment stats for the caller''s resource office. Does not return raw event rows.';

-- Feedback passcode hash must never be readable by clients (anon or authenticated).
revoke select (feedback_access_code_hash) on public.student_feed_posts from anon, authenticated, public;

-- Verify RPC is for the Edge Function (service role), not browser clients.
revoke all on function public.verify_feedback_access_code(uuid, text) from public, anon, authenticated;
grant execute on function public.verify_feedback_access_code(uuid, text) to service_role;

-- Anonymous visitors may only read public-safe columns of posted events.
revoke select on public.event_requests from anon;
grant select (
  id,
  activity,
  start_date,
  end_date,
  start_time,
  end_time,
  venue,
  status,
  posted_at,
  calendar_posted_at,
  organization_id,
  request_type
) on public.event_requests to anon;
