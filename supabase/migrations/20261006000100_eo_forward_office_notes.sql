-- EO instructions per resource office when forwarding a request.
-- Notes live in their own table so row-level security can hide them from
-- requesters, who can read their own request's assignment rows.

create table if not exists public.event_request_office_notes (
  request_id uuid not null references public.event_requests (id) on delete cascade,
  assigned_office public.resource_office not null,
  note text not null check (length(trim(note)) between 1 and 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (request_id, assigned_office)
);

comment on table public.event_request_office_notes is
  'EO notes to resource offices. Readable by EO, Admin, and the addressed office only.';

alter table public.event_request_office_notes enable row level security;

revoke all on table public.event_request_office_notes from public, anon, authenticated;
grant select on table public.event_request_office_notes to authenticated;

drop policy if exists event_request_office_notes_select on public.event_request_office_notes;
create policy event_request_office_notes_select on public.event_request_office_notes
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'eo')
    or public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), assigned_office::text::public.app_role)
  );

-- Same signature and behavior as 20260909000200; each assignment item may carry
-- an optional office_note. Notes are replaced on every forward.
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
  v_note text;
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
  delete from public.event_request_office_notes where request_id = p_request_id;

  for v_item in select value from jsonb_array_elements(p_assignments)
  loop
    v_kind := (v_item ->> 'resource_kind')::public.resource_kind;
    v_office := (v_item ->> 'assigned_office')::public.resource_office;
    v_name := trim(coalesce(v_item ->> 'resource_name', ''));
    v_quantity := greatest(1, coalesce((v_item ->> 'quantity')::integer, 1));
    v_venue_id := nullif(v_item ->> 'venue_id', '')::uuid;
    v_equipment_id := nullif(v_item ->> 'equipment_id', '')::uuid;
    v_note := nullif(trim(coalesce(v_item ->> 'office_note', '')), '');

    if v_name = '' then raise exception 'Every resource assignment needs a name.'; end if;
    if v_office::text not in ('gso', 'it_infrastructure', 'sports_office', 'ssc') then
      raise exception 'Invalid responsible office.';
    end if;
    if v_note is not null and length(v_note) > 500 then
      raise exception 'Office notes are limited to 500 characters.';
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

    if v_note is not null then
      insert into public.event_request_office_notes (request_id, assigned_office, note, created_by)
      values (p_request_id, v_office, v_note, v_actor)
      on conflict (request_id, assigned_office) do update
        set note = excluded.note, created_by = excluded.created_by, created_at = now();
    end if;

    insert into public.event_request_history (request_id, actor_id, action, step, comment, metadata)
    values (
      p_request_id, v_actor,
      case when v_kind = 'equipment' then 'equipment_assigned' else 'venue_assigned' end,
      'eo_schedule',
      'EO forwarded ' || v_kind::text || ' "' || v_name || '" to ' || v_office::text
        || case when v_note is null then '' else ' — Note: ' || left(v_note, 200) end,
      jsonb_build_object(
        'assigned_office', v_office, 'resource_kind', v_kind,
        'resource_name', v_name, 'venue_id', v_venue_id,
        'equipment_id', v_equipment_id, 'quantity', v_quantity, 'decision', 'assigned',
        'office_note', v_note
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

revoke all on function public.eo_forward_event_request(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.eo_forward_event_request(uuid, jsonb) to authenticated;
