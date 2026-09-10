-- Read-only, least-privilege projections for large filtered portal queries.

create or replace function public.eo_event_log_page(
  p_date_from date default null,
  p_date_to date default null,
  p_organization_id uuid default null,
  p_college_id uuid default null,
  p_status text default null,
  p_action text default null,
  p_venue text default null,
  p_office text default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_office text := nullif(lower(trim(coalesce(p_office, ''))), '');
  v_result jsonb;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'eo'::public.app_role) then
    raise exception using
      errcode = '42501',
      message = 'Executive Officer access is required.';
  end if;

  with projected as (
    select
      h.id,
      h.request_id,
      r.activity as event_name,
      r.organization_id,
      coalesce(nullif(trim(o.name), ''), 'Organization') as organization_name,
      o.college_id,
      coalesce(nullif(trim(c.name), ''), 'Unassigned College') as college_name,
      r.venue,
      r.status::text as request_status,
      h.action,
      h.step::text as step,
      h.comment,
      coalesce(h.metadata, '{}'::jsonb) as metadata,
      h.actor_id,
      coalesce(nullif(trim(actor.display_name), ''), 'System') as actor_name,
      actor_role.role::text as actor_role,
      coalesce(
        nullif(lower(trim(h.metadata ->> 'office')), ''),
        nullif(lower(trim(h.metadata ->> 'assigned_office')), ''),
        case h.step::text
          when 'eo_schedule' then 'eo'
          when 'eo_publish' then 'eo'
          when 'resource_offices' then 'resource'
          else h.step::text
        end,
        actor_role.role::text
      ) as office,
      h.created_at
    from public.event_request_history h
    join public.event_requests r on r.id = h.request_id
    left join public.organizations o on o.id = r.organization_id
    left join public.colleges c on c.id = o.college_id
    left join public.profiles actor on actor.id = h.actor_id
    left join public.user_roles actor_role on actor_role.user_id = h.actor_id
    where (p_date_from is null or h.created_at >= p_date_from::timestamptz)
      and (p_date_to is null or h.created_at < (p_date_to + 1)::timestamptz)
      and (p_organization_id is null or r.organization_id = p_organization_id)
      and (p_college_id is null or o.college_id = p_college_id)
      and (
        nullif(trim(coalesce(p_status, '')), '') is null
        or r.status::text = trim(p_status)
      )
      and (
        nullif(trim(coalesce(p_action, '')), '') is null
        or h.action = trim(p_action)
      )
      and (
        nullif(trim(coalesce(p_venue, '')), '') is null
        or r.venue ilike '%' || trim(p_venue) || '%'
      )
  ),
  filtered as (
    select *
    from projected p
    where v_office is null
      or (
        case v_office
          when 'it' then
            p.office in ('it', 'it_infrastructure')
            or coalesce(p.comment, '') ilike '%it infrastructure%'
          when 'sports' then
            p.office in ('sports', 'sports_office')
            or coalesce(p.comment, '') ilike '%sports office%'
          when 'eo' then
            p.office in ('eo', 'executive_officer')
            or coalesce(p.comment, '') ilike '%executive officer%'
          when 'resource' then
            p.office in ('resource', 'resource_offices')
          else p.office = v_office
        end
      )
  ),
  paged as (
    select *
    from filtered
    order by created_at desc, id desc
    offset (v_page - 1) * v_page_size
    limit v_page_size
  )
  select jsonb_build_object(
    'rows',
    coalesce(
      (
        select jsonb_agg(to_jsonb(p) order by p.created_at desc, p.id desc)
        from paged p
      ),
      '[]'::jsonb
    ),
    'total',
    (select count(*) from filtered)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.eo_event_log_page(
  date, date, uuid, uuid, text, text, text, text, integer, integer
) from public, anon, authenticated;
grant execute on function public.eo_event_log_page(
  date, date, uuid, uuid, text, text, text, text, integer, integer
) to authenticated;

comment on function public.eo_event_log_page(
  date, date, uuid, uuid, text, text, text, text, integer, integer
) is
  'EO-only Event Log projection with server-side filters, deterministic pagination, actor identity, and exact totals.';

-- Public event reads must behave the same for anonymous visitors and signed-in
-- users who do not have a portal role. Returning an explicit projection avoids
-- granting authenticated users access to private workflow/evidence columns.
create or replace function public.public_event_requests()
returns table (
  id uuid,
  request_type text,
  status text,
  organization_id uuid,
  activity text,
  start_date date,
  end_date date,
  start_time time,
  end_time time,
  venue text,
  venue_id uuid,
  number_of_participants integer,
  sdgs text,
  purpose text,
  posted_at timestamptz,
  calendar_posted_at timestamptz,
  student_post_caption text,
  student_post_image_path text,
  created_at timestamptz,
  updated_at timestamptz,
  organization_name text,
  college_id uuid
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    r.id,
    r.request_type::text,
    r.status::text,
    r.organization_id,
    r.activity,
    r.start_date,
    r.end_date,
    r.start_time,
    r.end_time,
    r.venue,
    r.venue_id,
    r.number_of_participants,
    r.sdgs,
    r.purpose,
    r.posted_at,
    r.calendar_posted_at,
    r.student_post_caption,
    r.student_post_image_path,
    r.created_at,
    r.updated_at,
    o.name,
    o.college_id
  from public.event_requests r
  left join public.organizations o on o.id = r.organization_id
  where r.deleted_at is null
    and r.status::text = 'posted'
  order by r.start_date, r.start_time, r.id
  limit 500;
$$;

revoke all on function public.public_event_requests() from public, anon, authenticated;
grant execute on function public.public_event_requests() to anon, authenticated;

comment on function public.public_event_requests() is
  'Public-safe posted event projection for anonymous and roleless authenticated visitors.';
