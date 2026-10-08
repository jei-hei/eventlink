-- Student officer and SSC requests may include up to 3 proposal PDFs.
-- The function signature stays the same. Extra paths travel in p_request.letter_paths.

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
  v_paths text[] := '{}';
  v_path text;
  v_primary text;
  v_letter_index integer;
begin
  if v_actor is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  if p_request_id is null then raise exception 'A request ID is required.'; end if;
  if jsonb_typeof(p_request) <> 'object' then raise exception 'Invalid event request payload.'; end if;
  if jsonb_typeof(coalesce(p_equipment, '[]'::jsonb)) <> 'array' then
    raise exception 'Invalid equipment payload.';
  end if;
  if p_request ? 'letter_paths' and jsonb_typeof(p_request -> 'letter_paths') is distinct from 'array' then
    raise exception 'Invalid proposal list.';
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

  if jsonb_typeof(p_request -> 'letter_paths') = 'array' then
    for v_path in
      select nullif(trim(value), '')
      from jsonb_array_elements_text(p_request -> 'letter_paths') as listed(value)
    loop
      if v_path is null or v_path = any (v_paths) then
        continue;
      end if;
      v_paths := array_append(v_paths, v_path);
    end loop;
  end if;
  if cardinality(v_paths) = 0 and nullif(trim(coalesce(p_letter_path, '')), '') is not null then
    v_paths := array[trim(p_letter_path)];
  end if;
  v_primary := v_paths[1];

  if cardinality(v_paths) > 3 then
    raise exception 'A request can include at most 3 PDF proposals.';
  end if;
  if v_type = 'eo_direct' and cardinality(v_paths) > 1 then
    raise exception 'A direct event can include one document.';
  end if;
  if v_type <> 'eo_direct' and v_primary is null then
    raise exception 'A PDF proposal is required.';
  end if;
  if p_letter_path is not null and v_primary is distinct from trim(p_letter_path) then
    raise exception 'The proposal path does not belong to this request.';
  end if;

  if cardinality(v_paths) > 0 then
    foreach v_path in array v_paths loop
      if v_path not like (v_actor::text || '/' || p_request_id::text || '/%')
         or v_path !~* '\.pdf$' then
        raise exception 'The proposal path does not belong to this request.';
      end if;
    end loop;
    if not public.has_event_request_upload_intent(p_request_id) then
      raise exception 'The proposal upload authorization is missing or expired.';
    end if;
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
    v_primary,
    v_primary,
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

  for v_letter_index in 1..coalesce(cardinality(v_paths), 0) loop
    insert into public.event_request_letters (request_id, letter_path, label, created_by)
    values (
      p_request_id,
      v_paths[v_letter_index],
      case
        when v_type = 'eo_direct' then 'Event document'
        when cardinality(v_paths) = 1 then 'Version 1 — Original Proposal'
        else 'Proposal ' || v_letter_index
      end,
      v_actor
    );
  end loop;

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
