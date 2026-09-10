-- Transactional event workflow and resource integrity.
-- Forward-only: introduces canonical RPC mutation boundaries and reservation ledgers.

create extension if not exists btree_gist with schema extensions;

create table public.event_venue_reservations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.event_requests (id) on delete cascade,
  venue_id uuid references public.venues (id) on delete set null,
  venue_key text not null,
  starts_at timestamp not null,
  ends_at timestamp not null,
  reserved_by uuid references auth.users (id) on delete set null,
  reserved_at timestamptz not null default now(),
  released_at timestamptz,
  release_reason text,
  constraint event_venue_reservations_time_check check (ends_at > starts_at)
);

create unique index event_venue_reservations_active_request_idx
  on public.event_venue_reservations (request_id)
  where released_at is null;

alter table public.event_venue_reservations
  add constraint event_venue_reservations_no_overlap
  exclude using gist (
    venue_key with =,
    tsrange(starts_at, ends_at, '[)') with &&
  )
  where (released_at is null);

create table public.event_equipment_reservations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.event_requests (id) on delete cascade,
  equipment_id uuid not null references public.equipment (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  inventory_applied boolean not null default true,
  reserved_by uuid references auth.users (id) on delete set null,
  reserved_at timestamptz not null default now(),
  released_at timestamptz,
  release_reason text
);

create table public.event_request_upload_intents (
  request_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now()
);

alter table public.event_request_upload_intents enable row level security;
revoke all on public.event_request_upload_intents from public, anon, authenticated;

alter table public.event_request_resource_assignments
  add column if not exists allocates_inventory boolean not null default false;

create unique index event_request_one_inventory_allocator_idx
  on public.event_request_resource_assignments (request_id, equipment_id)
  where resource_kind = 'equipment' and equipment_id is not null and allocates_inventory;

create unique index event_equipment_reservations_active_item_idx
  on public.event_equipment_reservations (request_id, equipment_id)
  where released_at is null;

create index event_equipment_reservations_equipment_idx
  on public.event_equipment_reservations (equipment_id)
  where released_at is null;

alter table public.event_venue_reservations enable row level security;
alter table public.event_equipment_reservations enable row level security;

create policy event_venue_reservations_read on public.event_venue_reservations
  for select to authenticated
  using (public.can_access_event_request_details(request_id));

create policy event_equipment_reservations_read on public.event_equipment_reservations
  for select to authenticated
  using (public.can_access_event_request_details(request_id));

revoke insert, update, delete on public.event_venue_reservations from authenticated;
revoke insert, update, delete on public.event_equipment_reservations from authenticated;

create or replace function public.prepare_event_request_upload(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
begin
  if auth.uid() is null or p_request_id is null then
    raise exception 'Authentication and request ID are required.' using errcode = '42501';
  end if;
  v_role := public.get_user_role(auth.uid());
  if v_role is null or v_role not in ('student_officer', 'ssc', 'eo', 'admin') then
    raise exception 'Your role cannot prepare an event upload.' using errcode = '42501';
  end if;
  insert into public.event_request_upload_intents (request_id, user_id, expires_at)
  values (p_request_id, auth.uid(), now() + interval '15 minutes')
  on conflict (request_id) do update
    set expires_at = excluded.expires_at
  where public.event_request_upload_intents.user_id = auth.uid();
end;
$$;

create or replace function public.has_event_request_upload_intent(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.event_request_upload_intents i
    where i.request_id = p_request_id
      and i.user_id = auth.uid()
      and i.expires_at > now()
  );
$$;

revoke all on function public.prepare_event_request_upload(uuid) from public, anon, authenticated;
revoke all on function public.has_event_request_upload_intent(uuid) from public, anon, authenticated;
grant execute on function public.prepare_event_request_upload(uuid) to authenticated;
grant execute on function public.has_event_request_upload_intent(uuid) to authenticated;

drop policy if exists event_letters_insert_upload_intent on storage.objects;
create policy event_letters_insert_upload_intent
on storage.objects for insert to authenticated
with check (
  bucket_id = 'event-letters'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (storage.foldername(name))[3] is null
  and lower(storage.extension(name)) = 'pdf'
  and public.has_event_request_upload_intent(((storage.foldername(name))[2])::uuid)
);

create or replace function public.event_venue_key(p_venue_id uuid, p_venue text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_venue_id is not null then 'id:' || p_venue_id::text
    else 'name:' || lower(regexp_replace(trim(coalesce(p_venue, '')), '\s+', ' ', 'g'))
  end;
$$;

create or replace function public.event_request_actor_can_handle(
  p_request public.event_requests,
  p_actor uuid,
  p_role public.app_role
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_role = 'admin' then true
    when p_role = 'adviser' and p_request.current_step = 'adviser' then exists (
      select 1 from public.profiles p
      where p.id = p_actor and p.organization_id = p_request.organization_id
    )
    when p_role = 'dean' and p_request.current_step = 'dean' then exists (
      select 1
      from public.profiles p
      join public.organizations o on o.id = p_request.organization_id
      where p.id = p_actor and p.college_id = o.college_id
    )
    when p_role = 'osas' then p_request.current_step = 'osas'
    when p_role = 'eo' then p_request.current_step in ('eo_schedule', 'eo_publish')
    when p_role = 'gso' then p_request.current_step = 'gso'
    else false
  end;
$$;

revoke all on function public.event_request_actor_can_handle(public.event_requests, uuid, public.app_role)
  from public, anon, authenticated;

create or replace function public.release_event_resources(
  p_request_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allocation record;
begin
  for v_allocation in
    select equipment_id, sum(quantity)::integer as quantity
    from public.event_equipment_reservations
    where request_id = p_request_id
      and released_at is null
      and inventory_applied
    group by equipment_id
    order by equipment_id
  loop
    perform 1
    from public.equipment
    where id = v_allocation.equipment_id
    for update;

    update public.equipment
    set quantity_available = quantity_available + v_allocation.quantity
    where id = v_allocation.equipment_id;
  end loop;

  update public.event_equipment_reservations
  set released_at = now(), release_reason = p_reason
  where request_id = p_request_id and released_at is null;

  update public.event_venue_reservations
  set released_at = now(), release_reason = p_reason
  where request_id = p_request_id and released_at is null;

  update public.event_request_resource_assignments
  set status = case when status = 'pending' then 'declined' else status end,
      decline_reason = case
        when status = 'pending' then coalesce(nullif(trim(p_reason), ''), 'Workflow closed')
        else decline_reason
      end,
      decided_at = case when status = 'pending' then now() else decided_at end
  where request_id = p_request_id;
end;
$$;

revoke all on function public.release_event_resources(uuid, text) from public, anon, authenticated;

create or replace function public.reserve_event_venue(
  p_request public.event_requests,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  v_key := public.event_venue_key(p_request.venue_id, p_request.venue);
  if v_key = 'name:' then
    raise exception 'A venue is required.';
  end if;

  -- Serialize contenders even before either reservation row exists.
  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));

  if exists (
    select 1
    from public.event_requests r
    where r.id <> p_request.id
      and r.deleted_at is null
      and r.status in ('pending', 'approved', 'posted')
      and (
        (p_request.venue_id is not null and r.venue_id = p_request.venue_id)
        or lower(regexp_replace(trim(r.venue), '\s+', ' ', 'g'))
           = lower(regexp_replace(trim(p_request.venue), '\s+', ' ', 'g'))
      )
      and tsrange(r.start_date + r.start_time, r.end_date + r.end_time, '[)')
          && tsrange(
            p_request.start_date + p_request.start_time,
            p_request.end_date + p_request.end_time,
            '[)'
          )
  ) then
    raise exception 'This venue is already booked for an overlapping date and time.'
      using errcode = '23P01';
  end if;

  insert into public.event_venue_reservations (
    request_id, venue_id, venue_key, starts_at, ends_at, reserved_by
  )
  values (
    p_request.id,
    p_request.venue_id,
    v_key,
    p_request.start_date + p_request.start_time,
    p_request.end_date + p_request.end_time,
    p_actor
  );
exception
  when exclusion_violation or unique_violation then
    raise exception 'This venue is already booked for an overlapping date and time.'
      using errcode = '23P01';
end;
$$;

revoke all on function public.reserve_event_venue(public.event_requests, uuid)
  from public, anon, authenticated;

create or replace function public.check_venue_availability(
  p_venue text,
  p_start date,
  p_end date,
  p_exclude_id uuid default null,
  p_start_time time default null,
  p_end_time time default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with requested as (
    select
      lower(regexp_replace(trim(coalesce(p_venue, '')), '\s+', ' ', 'g')) as venue_name,
      case
        when p_start_time is null or p_end_time is null then p_start::timestamp
        else p_start + p_start_time
      end as starts_at,
      case
        when p_start_time is null or p_end_time is null then (p_end + 1)::timestamp
        else p_end + p_end_time
      end as ends_at
  )
  select
    p_start is not null
    and p_end is not null
    and p_end >= p_start
    and requested.venue_name <> ''
    and requested.ends_at > requested.starts_at
    and not exists (
      -- Canonical reservations are authoritative once a request has entered the ledger.
      select 1
      from public.event_venue_reservations reservation
      join public.event_requests event on event.id = reservation.request_id
      where reservation.released_at is null
        and event.deleted_at is null
        and event.status in ('pending', 'approved', 'posted')
        and (p_exclude_id is null or event.id <> p_exclude_id)
        and lower(regexp_replace(trim(event.venue), '\s+', ' ', 'g')) = requested.venue_name
        and tsrange(reservation.starts_at, reservation.ends_at, '[)')
            && tsrange(requested.starts_at, requested.ends_at, '[)')
    )
    and not exists (
      -- Compatibility for active rows created before the reservation ledger. A row with
      -- a released reservation is intentionally not treated as an active booking.
      select 1
      from public.event_requests event
      where event.deleted_at is null
        and event.status in ('pending', 'approved', 'posted')
        and (p_exclude_id is null or event.id <> p_exclude_id)
        and lower(regexp_replace(trim(event.venue), '\s+', ' ', 'g')) = requested.venue_name
        and not exists (
          select 1
          from public.event_venue_reservations any_reservation
          where any_reservation.request_id = event.id
        )
        and tsrange(event.start_date + event.start_time, event.end_date + event.end_time, '[)')
            && tsrange(requested.starts_at, requested.ends_at, '[)')
    )
  from requested;
$$;

create or replace function public.check_venue_availability(
  p_venue text,
  p_start date,
  p_end date,
  p_exclude_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.check_venue_availability(
    p_venue, p_start, p_end, p_exclude_id, null::time, null::time
  );
$$;

revoke all on function public.check_venue_availability(text, date, date, uuid, time, time)
  from public, anon, authenticated;
revoke all on function public.check_venue_availability(text, date, date, uuid)
  from public, anon, authenticated;
grant execute on function public.check_venue_availability(text, date, date, uuid, time, time)
  to authenticated;
grant execute on function public.check_venue_availability(text, date, date, uuid)
  to authenticated;

create or replace function public.event_workflow_decide(
  p_request_id uuid,
  p_decision text,
  p_reason text default null,
  p_attachment_path text default null,
  p_attachment_name text default null
)
returns public.event_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.event_requests;
  v_actor uuid := auth.uid();
  v_role public.app_role;
  v_next public.workflow_step;
  v_step public.workflow_step;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if v_actor is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  v_role := public.get_user_role(v_actor);
  if v_role is null then raise exception 'A portal role is required.' using errcode = '42501'; end if;

  select * into v_request
  from public.event_requests
  where id = p_request_id and deleted_at is null
  for update;
  if not found then raise exception 'Event request not found.'; end if;
  if v_request.status <> 'pending' then raise exception 'Only pending requests can be decided.'; end if;
  if not public.event_request_actor_can_handle(v_request, v_actor, v_role) then
    raise exception 'You are not authorized to decide this workflow step.' using errcode = '42501';
  end if;
  if v_request.current_step = 'resource_offices'
     or (
       p_decision = 'approve'
       and v_request.current_step in ('eo_schedule', 'eo_publish')
     ) then
    raise exception 'Use the dedicated workflow action for this step.';
  end if;

  if p_decision = 'approve' then
    v_step := v_request.current_step;
    v_next := case
      when v_request.current_step = 'adviser' then 'dean'::public.workflow_step
      when v_request.current_step = 'dean' then 'osas'::public.workflow_step
      when v_request.current_step = 'osas' then 'eo_schedule'::public.workflow_step
      when v_request.current_step = 'gso' then 'eo_publish'::public.workflow_step
      else null
    end;
    if v_next is null then raise exception 'Invalid approval transition.'; end if;

    update public.event_requests set current_step = v_next where id = p_request_id
    returning * into v_request;
    insert into public.event_request_history (request_id, actor_id, action, step, comment, metadata)
    values (
      p_request_id, v_actor, 'approved', v_step,
      'Approved workflow step',
      jsonb_build_object('decision', 'approved', 'next_step', v_next)
    );
  elsif p_decision in ('decline', 'revision') then
    if v_reason is null then raise exception 'A reason is required.'; end if;
    perform public.release_event_resources(
      p_request_id,
      case when p_decision = 'revision' then 'Revision requested' else 'Declined' end
    );
    update public.event_requests
    set status = case
          when p_decision = 'revision' then 'revision_requested'::public.request_status
          else 'declined'::public.request_status
        end,
        decline_reason = v_reason,
        declined_at_step = current_step
    where id = p_request_id
    returning * into v_request;

    if p_decision = 'revision' then
      insert into public.event_request_compliance_comments (
        request_id, comment, attachment_path, attachment_name, sender_id, sender_role
      ) values (
        p_request_id, v_reason, p_attachment_path, p_attachment_name, v_actor, v_role
      );
    end if;

    insert into public.event_request_history (request_id, actor_id, action, step, comment, metadata)
    values (
      p_request_id, v_actor,
      case when p_decision = 'revision' then 'revision_requested' else 'declined' end,
      v_request.declined_at_step, v_reason,
      jsonb_build_object('decision', p_decision, 'reason', v_reason)
    );
  else
    raise exception 'Unsupported workflow decision.';
  end if;
  return v_request;
end;
$$;

create or replace function public.create_event_request_transactional(
  p_request_id uuid,
  p_request jsonb,
  p_letter_path text default null,
  p_equipment jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.app_role;
  v_type public.request_type;
  v_initial_step public.workflow_step;
  v_request public.event_requests;
  v_item jsonb;
  v_equipment_id uuid;
  v_quantity integer;
  v_org_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  if p_request_id is null then raise exception 'A request ID is required.'; end if;
  if jsonb_typeof(p_request) <> 'object' then raise exception 'Invalid event request payload.'; end if;
  if jsonb_typeof(coalesce(p_equipment, '[]'::jsonb)) <> 'array' then
    raise exception 'Invalid equipment payload.';
  end if;

  v_role := public.get_user_role(v_actor);
  v_type := (p_request ->> 'request_type')::public.request_type;
  v_org_id := nullif(p_request ->> 'organization_id', '')::uuid;
  if v_role is null or not (
    (v_type = 'student_officer' and v_role = 'student_officer')
    or (v_type = 'ssc' and v_role = 'ssc')
    or (v_type = 'eo_direct' and v_role in ('eo', 'admin'))
  ) then
    raise exception 'Your role cannot create this request type.' using errcode = '42501';
  end if;
  if v_type = 'student_officer' and not exists (
    select 1 from public.profiles p
    where p.id = v_actor and p.organization_id = v_org_id
  ) then
    raise exception 'The request organization must match your profile.' using errcode = '42501';
  end if;
  if v_type <> 'eo_direct' and nullif(trim(coalesce(p_letter_path, '')), '') is null then
    raise exception 'A PDF proposal is required.';
  end if;
  if p_letter_path is not null and p_letter_path not like (
    v_actor::text || '/' || p_request_id::text || '/%'
  ) then
    raise exception 'The proposal path does not belong to this request.';
  end if;
  if p_letter_path is not null
     and not public.has_event_request_upload_intent(p_request_id) then
    raise exception 'The proposal upload authorization is missing or expired.';
  end if;

  v_initial_step := case
    when v_type = 'student_officer' then 'adviser'::public.workflow_step
    when v_type = 'ssc' then 'osas'::public.workflow_step
    else null
  end;

  insert into public.event_requests (
    id, request_type, status, current_step, organization_id, submitted_by,
    activity, start_date, end_date, start_time, end_time, venue, venue_id,
    number_of_participants, sdgs, purpose, needs_gso, letter_path,
    original_letter_path, posted_at, calendar_posted_at
  ) values (
    p_request_id,
    v_type,
    case when v_type = 'eo_direct' then 'posted'::public.request_status else 'pending'::public.request_status end,
    v_initial_step,
    v_org_id,
    v_actor,
    trim(p_request ->> 'activity'),
    (p_request ->> 'start_date')::date,
    (p_request ->> 'end_date')::date,
    (p_request ->> 'start_time')::time,
    (p_request ->> 'end_time')::time,
    trim(p_request ->> 'venue'),
    nullif(p_request ->> 'venue_id', '')::uuid,
    (p_request ->> 'number_of_participants')::integer,
    trim(coalesce(p_request ->> 'sdgs', '')),
    trim(coalesce(p_request ->> 'purpose', '')),
    coalesce((p_request ->> 'needs_gso')::boolean, false),
    p_letter_path,
    p_letter_path,
    case when v_type = 'eo_direct' then now() else null end,
    case when v_type = 'eo_direct' then now() else null end
  )
  returning * into v_request;

  if v_request.activity = '' or v_request.venue = ''
     or v_request.end_date + v_request.end_time <= v_request.start_date + v_request.start_time then
    raise exception 'Invalid event name, venue, or schedule.';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_equipment, '[]'::jsonb))
  loop
    v_equipment_id := nullif(v_item ->> 'equipment_id', '')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_equipment_id is null or v_quantity is null or v_quantity <= 0 then
      raise exception 'Invalid equipment request.';
    end if;
    perform 1 from public.equipment
    where id = v_equipment_id and active and quantity_available >= v_quantity;
    if not found then raise exception 'Requested equipment is unavailable or insufficient.'; end if;
    insert into public.event_request_equipment (request_id, equipment_id, quantity_requested)
    values (p_request_id, v_equipment_id, v_quantity);
  end loop;

  if p_letter_path is not null then
    insert into public.event_request_letters (request_id, letter_path, label, created_by)
    values (
      p_request_id, p_letter_path,
      case when v_type = 'eo_direct' then 'Event document' else 'Version 1 — Original Proposal' end,
      v_actor
    );
  end if;

  perform public.reserve_event_venue(v_request, v_actor);

  insert into public.event_request_history (request_id, actor_id, action, step, comment, metadata)
  values (
    p_request_id, v_actor,
    case when v_type = 'eo_direct' then 'created' else 'submitted' end,
    v_initial_step,
    case when v_type = 'eo_direct' then 'Manually created calendar event' else 'Event request submitted' end,
    jsonb_build_object('source', case when v_type = 'eo_direct' then 'eo_direct' else 'portal' end)
  );
  delete from public.event_request_upload_intents
  where request_id = p_request_id and user_id = v_actor;
  return p_request_id;
end;
$$;

create or replace function public.eo_forward_event_request(
  p_request_id uuid,
  p_assignments jsonb
)
returns public.event_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.event_requests;
  v_actor uuid := auth.uid();
  v_role public.app_role;
  v_item jsonb;
  v_kind public.resource_kind;
  v_office public.resource_office;
  v_name text;
  v_quantity integer;
  v_venue_id uuid;
  v_equipment_id uuid;
  v_has_venue boolean := false;
  v_has_equipment boolean := false;
  v_allocates_inventory boolean;
begin
  if v_actor is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  v_role := public.get_user_role(v_actor);
  if v_role is null then raise exception 'A portal role is required.' using errcode = '42501'; end if;
  if v_role not in ('eo', 'admin') then
    raise exception 'Only EO can forward resource assignments.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_assignments) <> 'array' or jsonb_array_length(p_assignments) = 0 then
    raise exception 'At least one resource assignment is required.';
  end if;

  select * into v_request
  from public.event_requests
  where id = p_request_id and deleted_at is null
  for update;
  if not found then raise exception 'Event request not found.'; end if;
  if v_request.status <> 'pending' or v_request.current_step <> 'eo_schedule' then
    raise exception 'Only requests pending EO review can be forwarded.';
  end if;

  delete from public.event_request_resource_assignments where request_id = p_request_id;

  for v_item in select value from jsonb_array_elements(p_assignments)
  loop
    v_kind := (v_item ->> 'resource_kind')::public.resource_kind;
    v_office := (v_item ->> 'assigned_office')::public.resource_office;
    v_name := trim(coalesce(v_item ->> 'resource_name', ''));
    v_quantity := greatest(1, coalesce((v_item ->> 'quantity')::integer, 1));
    v_venue_id := nullif(v_item ->> 'venue_id', '')::uuid;
    v_equipment_id := nullif(v_item ->> 'equipment_id', '')::uuid;

    if v_name = '' then raise exception 'Every resource assignment needs a name.'; end if;
    if v_office::text not in ('gso', 'it_infrastructure', 'sports_office', 'ssc') then
      raise exception 'Invalid responsible office.';
    end if;
    if v_kind = 'venue' then
      v_has_venue := true;
      if v_request.venue_id is not null and v_venue_id is distinct from v_request.venue_id then
        raise exception 'Venue assignment does not match the request.';
      end if;
    elsif v_kind = 'equipment' then
      v_has_equipment := true;
      if v_equipment_id is null or not exists (
        select 1 from public.event_request_equipment e
        where e.request_id = p_request_id and e.equipment_id = v_equipment_id
      ) then
        raise exception 'Equipment assignment does not match the request.';
      end if;
    end if;
    v_allocates_inventory := v_kind = 'equipment' and not exists (
      select 1
      from public.event_request_resource_assignments a
      where a.request_id = p_request_id
        and a.equipment_id = v_equipment_id
        and a.allocates_inventory
    );

    insert into public.event_request_resource_assignments (
      request_id, resource_kind, venue_id, equipment_id, resource_name,
      quantity, assigned_office, status, assigned_by, assigned_at, allocates_inventory
    ) values (
      p_request_id, v_kind, v_venue_id, v_equipment_id, v_name,
      v_quantity, v_office, 'pending', v_actor, now(), v_allocates_inventory
    );

    insert into public.event_request_history (request_id, actor_id, action, step, comment, metadata)
    values (
      p_request_id, v_actor,
      case when v_kind = 'equipment' then 'equipment_assigned' else 'venue_assigned' end,
      'eo_schedule',
      'EO forwarded ' || v_kind::text || ' "' || v_name || '" to ' || v_office::text,
      jsonb_build_object(
        'assigned_office', v_office, 'resource_kind', v_kind,
        'resource_name', v_name, 'venue_id', v_venue_id,
        'equipment_id', v_equipment_id, 'quantity', v_quantity, 'decision', 'assigned'
      )
    );
  end loop;

  if not v_has_venue then raise exception 'A venue assignment is required.'; end if;
  if exists (select 1 from public.event_request_equipment where request_id = p_request_id)
     and not v_has_equipment then
    raise exception 'Equipment assignments are required.';
  end if;
  if exists (
    select 1
    from public.event_request_resource_assignments assigned
    left join public.event_request_equipment requested
      on requested.request_id = p_request_id
     and requested.equipment_id = assigned.equipment_id
    where assigned.request_id = p_request_id
      and assigned.resource_kind = 'equipment'
      and (
        requested.id is null
        or assigned.quantity <> requested.quantity_requested
      )
  ) then
    raise exception 'Every equipment reviewer must reference the requested quantity.';
  end if;

  perform public.reserve_event_venue(v_request, v_actor)
    where not exists (
      select 1 from public.event_venue_reservations
      where request_id = p_request_id and released_at is null
    );

  update public.event_requests
  set current_step = 'resource_offices',
      needs_gso = exists (
        select 1 from public.event_request_resource_assignments
        where request_id = p_request_id and assigned_office = 'gso'
      )
  where id = p_request_id
  returning * into v_request;
  return v_request;
end;
$$;

create or replace function public.event_resource_notification_recipients(
  p_request_id uuid,
  p_office public.resource_office
)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select ur.user_id
  from public.user_roles ur
  where auth.uid() is not null
    and public.get_user_role(auth.uid()) in ('eo', 'admin')
    and ur.role::text = p_office::text
    and exists (
      select 1
      from public.event_request_resource_assignments a
      where a.request_id = p_request_id
        and a.assigned_office = p_office
    );
$$;

create or replace function public.resource_office_decide_event_request(
  p_request_id uuid,
  p_decision text,
  p_reason text default null
)
returns public.event_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.event_requests;
  v_actor uuid := auth.uid();
  v_role public.app_role;
  v_office public.resource_office;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_assignment record;
  v_allocation record;
begin
  if v_actor is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  v_role := public.get_user_role(v_actor);
  v_office := case v_role::text
    when 'gso' then 'gso'::public.resource_office
    when 'it_infrastructure' then 'it_infrastructure'::public.resource_office
    when 'sports_office' then 'sports_office'::public.resource_office
    when 'ssc' then 'ssc'::public.resource_office
    else null
  end;
  if v_office is null then raise exception 'This role is not a resource office.' using errcode = '42501'; end if;
  if p_decision not in ('approve', 'decline') then raise exception 'Unsupported resource decision.'; end if;
  if p_decision = 'decline' and v_reason is null then raise exception 'A decline reason is required.'; end if;

  select * into v_request
  from public.event_requests
  where id = p_request_id and deleted_at is null
  for update;
  if not found then raise exception 'Event request not found.'; end if;
  if v_request.status <> 'pending' or v_request.current_step <> 'resource_offices' then
    raise exception 'This request is not awaiting resource-office approval.';
  end if;

  perform 1
  from public.event_request_resource_assignments
  where request_id = p_request_id and assigned_office = v_office
  for update;
  if not exists (
    select 1 from public.event_request_resource_assignments
    where request_id = p_request_id and assigned_office = v_office and status = 'pending'
  ) then
    raise exception 'No pending resources are assigned to your office.';
  end if;

  for v_assignment in
    select *
    from public.event_request_resource_assignments
    where request_id = p_request_id and assigned_office = v_office and status = 'pending'
    order by id
  loop
    update public.event_request_resource_assignments
    set status = case
          when p_decision = 'approve' then 'approved'::public.resource_assignment_status
          else 'declined'::public.resource_assignment_status
        end,
        decided_by = v_actor,
        decided_at = now(),
        decline_reason = case when p_decision = 'decline' then v_reason else null end
    where id = v_assignment.id;

    insert into public.event_request_history (request_id, actor_id, action, step, comment, metadata)
    values (
      p_request_id, v_actor,
      v_assignment.resource_kind::text || case when p_decision = 'approve' then '_approved' else '_declined' end,
      'resource_offices',
      v_office::text || ' ' || p_decision || 'd ' || v_assignment.resource_kind::text || ' "' || v_assignment.resource_name || '"',
      jsonb_build_object(
        'assigned_office', v_office, 'resource_kind', v_assignment.resource_kind,
        'resource_name', v_assignment.resource_name,
        'resource_id', coalesce(v_assignment.venue_id, v_assignment.equipment_id),
        'decision', p_decision, 'reason', v_reason
      )
    );
  end loop;

  if p_decision = 'decline' then
    perform public.release_event_resources(p_request_id, v_office::text || ': ' || v_reason);
    update public.event_requests
    set status = 'declined',
        decline_reason = v_office::text || ': ' || v_reason,
        declined_at_step = 'resource_offices',
        current_step = null,
        calendar_posted_at = null
    where id = p_request_id
    returning * into v_request;
    return v_request;
  end if;

  if exists (
    select 1 from public.event_request_resource_assignments
    where request_id = p_request_id and status <> 'approved'
  ) then
    select * into v_request from public.event_requests where id = p_request_id;
    return v_request;
  end if;

  -- Sum every approved assignment per item and lock inventory in UUID order.
  for v_allocation in
    select equipment_id, sum(quantity)::integer as quantity
    from public.event_request_resource_assignments
    where request_id = p_request_id
      and resource_kind = 'equipment'
      and equipment_id is not null
      and allocates_inventory
      and status = 'approved'
    group by equipment_id
    order by equipment_id
  loop
    perform 1 from public.equipment where id = v_allocation.equipment_id for update;
    if not found then raise exception 'Assigned equipment no longer exists.'; end if;
    if (select quantity_available from public.equipment where id = v_allocation.equipment_id) < v_allocation.quantity then
      raise exception 'Insufficient equipment stock for the approved allocation.';
    end if;
    update public.equipment
    set quantity_available = quantity_available - v_allocation.quantity
    where id = v_allocation.equipment_id;
    insert into public.event_equipment_reservations (
      request_id, equipment_id, quantity, inventory_applied, reserved_by
    ) values (
      p_request_id, v_allocation.equipment_id, v_allocation.quantity, true, v_actor
    );
  end loop;

  update public.event_requests
  set status = 'approved',
      current_step = 'eo_publish',
      calendar_posted_at = coalesce(calendar_posted_at, now())
  where id = p_request_id
  returning * into v_request;

  insert into public.event_request_history (request_id, actor_id, action, step, comment, metadata)
  values (
    p_request_id, v_actor, 'scheduled', 'resource_offices',
    'All resource offices approved — event automatically scheduled',
    jsonb_build_object('decision', 'scheduled', 'automatic', true)
  );
  return v_request;
end;
$$;

create or replace function public.event_request_lifecycle(
  p_request_id uuid,
  p_action text,
  p_reason text default null,
  p_caption text default null,
  p_image_path text default null
)
returns public.event_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.event_requests;
  v_actor uuid := auth.uid();
  v_role public.app_role;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_allocation record;
begin
  if v_actor is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  v_role := public.get_user_role(v_actor);
  if v_role is null then raise exception 'A portal role is required.' using errcode = '42501'; end if;
  select * into v_request from public.event_requests where id = p_request_id for update;
  if not found then raise exception 'Event request not found.'; end if;

  if p_action = 'calendar_post' then
    if v_role not in ('eo', 'admin') or v_request.current_step <> 'eo_publish'
       or v_request.status not in ('pending', 'approved') or v_request.calendar_posted_at is not null then
      raise exception 'Event is not ready for staff-calendar publication.';
    end if;
    perform public.reserve_event_venue(v_request, v_actor)
      where not exists (
        select 1 from public.event_venue_reservations
        where request_id = p_request_id and released_at is null
      );
    for v_allocation in
      select equipment_id, sum(quantity)::integer as quantity
      from public.event_request_resource_assignments
      where request_id = p_request_id
        and resource_kind = 'equipment'
        and equipment_id is not null
        and allocates_inventory
        and status = 'approved'
      group by equipment_id
      order by equipment_id
    loop
      if not exists (
        select 1
        from public.event_equipment_reservations
        where request_id = p_request_id
          and equipment_id = v_allocation.equipment_id
          and released_at is null
      ) then
        perform 1 from public.equipment where id = v_allocation.equipment_id for update;
        if not found or (
          select quantity_available from public.equipment where id = v_allocation.equipment_id
        ) < v_allocation.quantity then
          raise exception 'Insufficient equipment stock for calendar publication.';
        end if;
        update public.equipment
        set quantity_available = quantity_available - v_allocation.quantity
        where id = v_allocation.equipment_id;
        insert into public.event_equipment_reservations (
          request_id, equipment_id, quantity, inventory_applied, reserved_by
        ) values (
          p_request_id, v_allocation.equipment_id, v_allocation.quantity, true, v_actor
        );
      end if;
    end loop;
    update public.event_requests set calendar_posted_at = now() where id = p_request_id;
  elsif p_action = 'student_post' then
    if v_role not in ('student_officer', 'ssc')
       or v_request.submitted_by <> v_actor
       or v_request.current_step <> 'eo_publish'
       or v_request.status not in ('pending', 'approved')
       or nullif(trim(coalesce(p_caption, '')), '') is null then
      raise exception 'Event is not ready for student publication.';
    end if;
    update public.event_requests
    set status = 'posted', current_step = null, posted_at = now(),
        student_post_caption = trim(p_caption), student_post_image_path = p_image_path
    where id = p_request_id;
  elsif p_action in ('cancel', 'unpost', 'delete') then
    if v_role not in ('eo', 'admin') then raise exception 'EO authorization required.' using errcode = '42501'; end if;
    if p_action in ('cancel', 'delete') and v_reason is null then raise exception 'A reason is required.'; end if;
    if p_action = 'cancel' then
      if v_request.calendar_posted_at is null or v_request.status not in ('approved', 'posted') then
        raise exception 'Only scheduled events can be cancelled.';
      end if;
      perform public.release_event_resources(p_request_id, 'Cancelled: ' || v_reason);
      update public.event_requests
      set status = 'cancelled', current_step = null, calendar_posted_at = null,
          cancellation_reason = v_reason, cancelled_at = now(), cancelled_by = v_actor
      where id = p_request_id;
    elsif p_action = 'unpost' then
      if v_request.calendar_posted_at is null then raise exception 'Event is not on the staff calendar.'; end if;
      perform public.release_event_resources(p_request_id, 'Unposted');
      update public.event_requests set calendar_posted_at = null where id = p_request_id;
    else
      if v_request.deleted_at is not null then raise exception 'Event is already deleted.'; end if;
      perform public.release_event_resources(p_request_id, 'Deleted: ' || v_reason);
      update public.event_requests
      set deleted_at = now(), deleted_by = v_actor, deleted_reason = v_reason,
          calendar_posted_at = null, current_step = null
      where id = p_request_id;
    end if;
  else
    raise exception 'Unsupported lifecycle action.';
  end if;

  insert into public.event_request_history (request_id, actor_id, action, step, comment, metadata)
  values (
    p_request_id, v_actor,
    case p_action
      when 'calendar_post' then 'calendar_posted'
      when 'student_post' then 'posted'
      when 'cancel' then 'cancelled'
      when 'unpost' then 'unposted'
      when 'delete' then 'deleted'
    end,
    case when p_action in ('calendar_post', 'student_post', 'unpost') then 'eo_publish'::public.workflow_step else null end,
    coalesce(v_reason, case p_action
      when 'calendar_post' then 'Published to staff schedule calendar'
      when 'student_post' then 'Published to student dashboard'
      when 'unpost' then 'Removed from staff schedule calendar'
      else initcap(p_action)
    end),
    jsonb_build_object(
      'previous_status', v_request.status, 'previous_start_date', v_request.start_date,
      'previous_end_date', v_request.end_date, 'previous_start_time', v_request.start_time,
      'previous_end_time', v_request.end_time, 'previous_venue', v_request.venue,
      'reason', v_reason
    )
  );
  select * into v_request from public.event_requests where id = p_request_id;
  return v_request;
end;
$$;

create or replace function public.update_event_request_transactional(
  p_request_id uuid,
  p_patch jsonb,
  p_resubmit boolean default false,
  p_letter_path text default null
)
returns public.event_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.event_requests;
  v_new public.event_requests;
  v_actor uuid := auth.uid();
  v_role public.app_role;
  v_start_date date;
  v_end_date date;
  v_start_time time;
  v_end_time time;
  v_venue text;
  v_venue_id uuid;
  v_resume public.workflow_step;
  v_letter_version integer;
begin
  if v_actor is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  v_role := public.get_user_role(v_actor);
  if v_role is null then raise exception 'A portal role is required.' using errcode = '42501'; end if;
  select * into v_old from public.event_requests where id = p_request_id and deleted_at is null for update;
  if not found then raise exception 'Event request not found.'; end if;

  if p_resubmit then
    if v_old.submitted_by <> v_actor or v_role not in ('student_officer', 'ssc')
       or v_old.status not in ('declined', 'revision_requested') then
      raise exception 'Only the submitter can resubmit this request.' using errcode = '42501';
    end if;
    v_resume := case
      when v_old.status = 'revision_requested' and v_old.declined_at_step is not null
        then v_old.declined_at_step
      when v_old.request_type = 'ssc' then 'osas'::public.workflow_step
      else 'adviser'::public.workflow_step
    end;
  elsif v_role not in ('eo', 'admin') then
    raise exception 'Only EO can update an active event schedule.' using errcode = '42501';
  end if;
  if p_letter_path is not null then
    if not p_resubmit then
      raise exception 'A revised proposal is only accepted during resubmission.';
    end if;
    if p_letter_path not like (v_actor::text || '/' || p_request_id::text || '/%') then
      raise exception 'The revised proposal path does not belong to this request.';
    end if;
    if not public.has_event_request_upload_intent(p_request_id) then
      raise exception 'The revised proposal upload authorization is missing or expired.';
    end if;
    select count(*)::integer + 1 into v_letter_version
    from public.event_request_letters
    where request_id = p_request_id;
  end if;

  v_start_date := coalesce(nullif(p_patch ->> 'start_date', '')::date, v_old.start_date);
  v_end_date := coalesce(nullif(p_patch ->> 'end_date', '')::date, v_old.end_date);
  v_start_time := coalesce(nullif(p_patch ->> 'start_time', '')::time, v_old.start_time);
  v_end_time := coalesce(nullif(p_patch ->> 'end_time', '')::time, v_old.end_time);
  v_venue := trim(coalesce(p_patch ->> 'venue', v_old.venue));
  v_venue_id := case
    when p_patch ? 'venue_id' then nullif(p_patch ->> 'venue_id', '')::uuid
    else v_old.venue_id
  end;
  if v_end_date + v_end_time <= v_start_date + v_start_time then
    raise exception 'Event end must be after its start.';
  end if;

  if exists (
    select 1 from public.event_venue_reservations
    where request_id = p_request_id and released_at is null
  ) then
    perform pg_advisory_xact_lock(hashtextextended(public.event_venue_key(v_venue_id, v_venue), 0));
    begin
      update public.event_venue_reservations
      set venue_id = v_venue_id,
          venue_key = public.event_venue_key(v_venue_id, v_venue),
          starts_at = v_start_date + v_start_time,
          ends_at = v_end_date + v_end_time
      where request_id = p_request_id and released_at is null;
    exception when exclusion_violation then
      raise exception 'This venue is already booked for an overlapping date and time.'
        using errcode = '23P01';
    end;
  end if;

  if p_resubmit then
    perform public.release_event_resources(p_request_id, 'Resubmitted');
    delete from public.event_request_resource_assignments where request_id = p_request_id;
  end if;

  update public.event_requests
  set activity = trim(coalesce(p_patch ->> 'activity', activity)),
      start_date = v_start_date, end_date = v_end_date,
      start_time = v_start_time, end_time = v_end_time,
      venue = v_venue, venue_id = v_venue_id,
      number_of_participants = coalesce((p_patch ->> 'number_of_participants')::integer, number_of_participants),
      sdgs = trim(coalesce(p_patch ->> 'sdgs', sdgs)),
      purpose = trim(coalesce(p_patch ->> 'purpose', purpose)),
      letter_path = case
        when p_resubmit and p_letter_path is not null then p_letter_path
        else letter_path
      end,
      status = case when p_resubmit then 'pending'::public.request_status else status end,
      current_step = case when p_resubmit then v_resume else current_step end,
      decline_reason = case when p_resubmit then null else decline_reason end,
      declined_at_step = case when p_resubmit then null else declined_at_step end
  where id = p_request_id
  returning * into v_new;

  if p_resubmit then
    perform public.reserve_event_venue(v_new, v_actor);
  end if;
  if p_letter_path is not null then
    insert into public.event_request_letters (
      request_id, letter_path, label, created_by
    ) values (
      p_request_id,
      p_letter_path,
      'Version ' || v_letter_version || ' — Revised Proposal',
      v_actor
    );
    delete from public.event_request_upload_intents
    where request_id = p_request_id and user_id = v_actor;
  end if;

  insert into public.event_request_history (request_id, actor_id, action, step, comment, metadata)
  values (
    p_request_id, v_actor, case when p_resubmit then 'resubmitted' else 'updated' end,
    case when p_resubmit then v_resume else v_old.current_step end,
    case when p_resubmit then 'Request edited and resubmitted' else 'Event schedule updated' end,
    jsonb_build_object(
      'previous_start_date', v_old.start_date, 'new_start_date', v_new.start_date,
      'previous_end_date', v_old.end_date, 'new_end_date', v_new.end_date,
      'previous_start_time', v_old.start_time, 'new_start_time', v_new.start_time,
      'previous_end_time', v_old.end_time, 'new_end_time', v_new.end_time,
      'previous_venue', v_old.venue, 'new_venue', v_new.venue,
      'previous_letter_path', v_old.letter_path,
      'new_letter_path', p_letter_path
    )
  );
  return v_new;
end;
$$;

revoke all on function public.create_event_request_transactional(uuid, jsonb, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.event_workflow_decide(uuid, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.eo_forward_event_request(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.event_resource_notification_recipients(uuid, public.resource_office)
  from public, anon, authenticated;
revoke all on function public.resource_office_decide_event_request(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.event_request_lifecycle(uuid, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.update_event_request_transactional(uuid, jsonb, boolean, text)
  from public, anon, authenticated;

grant execute on function public.create_event_request_transactional(uuid, jsonb, text, jsonb) to authenticated;
grant execute on function public.event_workflow_decide(uuid, text, text, text, text) to authenticated;
grant execute on function public.eo_forward_event_request(uuid, jsonb) to authenticated;
grant execute on function public.event_resource_notification_recipients(uuid, public.resource_office)
  to authenticated;
grant execute on function public.resource_office_decide_event_request(uuid, text, text) to authenticated;
grant execute on function public.event_request_lifecycle(uuid, text, text, text, text) to authenticated;
grant execute on function public.update_event_request_transactional(uuid, jsonb, boolean, text)
  to authenticated;

-- Workflow identity is immutable after insert, including through privileged RPCs.
create or replace function public.protect_event_request_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.submitted_by is distinct from old.submitted_by
     or new.request_type is distinct from old.request_type
     or new.organization_id is distinct from old.organization_id then
    raise exception 'Event submitter, request type, and organization are immutable.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_event_request_identity on public.event_requests;
create trigger protect_event_request_identity
before update on public.event_requests
for each row execute function public.protect_event_request_identity();

-- Prevent direct client updates from bypassing canonical history and reservation logic.
revoke insert, delete on public.event_requests from anon, authenticated;
grant insert on public.event_requests to service_role;
revoke update on public.event_requests from anon, authenticated;
revoke insert, update, delete on public.event_request_resource_assignments from anon, authenticated;
revoke insert, update, delete on public.event_request_equipment from anon, authenticated;
revoke insert, update, delete on public.event_request_history from anon, authenticated;
revoke insert, update, delete on public.event_request_letters from anon, authenticated;
revoke insert, update, delete on public.event_request_compliance_comments from anon, authenticated;

-- Preflight legacy active rows. Silently omitting conflicts would leave the reservation
-- ledger non-canonical, so fail with the conflicting IDs for explicit remediation.
do $$
declare
  v_conflict record;
begin
  select a.id as first_id, b.id as second_id, a.venue
  into v_conflict
  from public.event_requests a
  join public.event_requests b on b.id > a.id
  where a.deleted_at is null
    and b.deleted_at is null
    and a.status in ('pending', 'approved', 'posted')
    and b.status in ('pending', 'approved', 'posted')
    and (
      (a.venue_id is not null and a.venue_id = b.venue_id)
      or lower(regexp_replace(trim(a.venue), '\s+', ' ', 'g'))
         = lower(regexp_replace(trim(b.venue), '\s+', ' ', 'g'))
    )
    and tsrange(a.start_date + a.start_time, a.end_date + a.end_time, '[)')
        && tsrange(b.start_date + b.start_time, b.end_date + b.end_time, '[)')
  limit 1;

  if found then
    raise exception
      'Legacy venue conflict must be resolved before migration: requests % and % overlap at %.',
      v_conflict.first_id, v_conflict.second_id, v_conflict.venue;
  end if;
end;
$$;

-- Data-preserving venue backfill after a clean preflight.
do $$
declare
  v_request public.event_requests;
begin
  for v_request in
    select *
    from public.event_requests
    where deleted_at is null
      and status in ('pending', 'approved', 'posted')
    order by created_at, id
  loop
    perform public.reserve_event_venue(v_request, v_request.submitted_by);
  end loop;
end;
$$;

-- Existing assignment rows mixed reviewer responsibility with allocation quantity.
-- Pick exactly one inventory-bearing reviewer per request/item; all rows still decide.
with ranked as (
  select id,
         row_number() over (
           partition by request_id, equipment_id
           order by assigned_at, id
         ) as allocation_rank
  from public.event_request_resource_assignments
  where resource_kind = 'equipment' and equipment_id is not null
)
update public.event_request_resource_assignments a
set allocates_inventory = ranked.allocation_rank = 1
from ranked
where ranked.id = a.id;

insert into public.event_equipment_reservations (
  request_id, equipment_id, quantity, inventory_applied, reserved_by, reserved_at
)
select
  a.request_id,
  a.equipment_id,
  a.quantity,
  false,
  null::uuid,
  coalesce(max(a.decided_at), now())
from public.event_request_resource_assignments a
join public.event_requests r on r.id = a.request_id
where a.resource_kind = 'equipment'
  and a.equipment_id is not null
  and a.allocates_inventory
  and a.status = 'approved'
  and r.deleted_at is null
  and r.calendar_posted_at is not null
  and r.status in ('approved', 'posted')
group by a.request_id, a.equipment_id, a.quantity
on conflict (request_id, equipment_id) where released_at is null do nothing;

comment on table public.event_venue_reservations is
  'Canonical active/released venue reservations; exclusion constraint prevents overlap.';
comment on table public.event_equipment_reservations is
  'Canonical equipment allocations used to release inventory exactly once.';
