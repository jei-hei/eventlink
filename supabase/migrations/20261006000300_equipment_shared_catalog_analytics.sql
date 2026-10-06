-- Equipment is one shared catalog managed by Admin; EO assigns any item to any office.
-- Office analytics therefore report inventory across the whole catalog, while usage
-- and event counts stay scoped to what EO assigned to the caller's office.
-- Same body as 20260908000300 except the equipment block has no responsible_office filter.

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

revoke all on function public.office_resource_analytics(text) from public, anon, authenticated;
grant execute on function public.office_resource_analytics(text) to authenticated;

comment on function public.office_resource_analytics(text) is
  'Aggregated stats for the caller''s resource office. Equipment inventory covers the shared catalog; usage is scoped to the office''s EO assignments.';
