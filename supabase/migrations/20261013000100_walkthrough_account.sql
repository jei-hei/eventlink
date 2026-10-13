-- Admin switch for one walkthrough login.
-- When walkthrough_enabled is true, that login can open an existing account's
-- portal. Turning it off clears the walkthrough login's role and assignment.
-- The account list used by the picker returns a name and place only.

alter table public.app_settings
  add column if not exists walkthrough_enabled boolean not null default false;

comment on column public.app_settings.walkthrough_enabled is
  'When true, the walkthrough login may open another account''s portal. When false, that login is refused and its role is cleared.';

alter table public.profiles
  add column if not exists is_walkthrough boolean not null default false;

alter table public.profiles
  add column if not exists walkthrough_subject_name text;

alter table public.profiles
  add column if not exists walkthrough_place text;

comment on column public.profiles.is_walkthrough is
  'True only for the login that may open another account''s portal while the admin switch is on.';

comment on column public.profiles.walkthrough_subject_name is
  'Name of the account currently opened by the walkthrough login.';

comment on column public.profiles.walkthrough_place is
  'College, organization, or program label for the opened account. No email or student ID.';

create unique index if not exists profiles_one_walkthrough_idx
  on public.profiles (is_walkthrough)
  where is_walkthrough;

create or replace function public.protect_profile_assignment_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if current_setting('app.walkthrough_assign', true) = 'on' then
    return new;
  end if;
  if auth.uid() is null then
    return new;
  end if;
  if public.has_role(auth.uid(), 'admin') then
    return new;
  end if;
  if new.college_id is distinct from old.college_id
     or new.organization_id is distinct from old.organization_id
     or new.student_id is distinct from old.student_id
     or new.is_walkthrough is distinct from old.is_walkthrough
     or new.walkthrough_subject_name is distinct from old.walkthrough_subject_name
     or new.walkthrough_place is distinct from old.walkthrough_place then
    raise exception 'College, organization, and student ID cannot be changed from the profile.';
  end if;
  return new;
end;
$$;

comment on function public.protect_profile_assignment_fields() is
  'Blocks non-admin updates to assignment fields and the walkthrough flag.';

create or replace function public.walkthrough_caller_allowed()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_walkthrough
  )
  and coalesce(
    (select s.walkthrough_enabled from public.app_settings s where s.id = 1),
    false
  );
$$;

revoke all on function public.walkthrough_caller_allowed() from public, anon, authenticated;

create or replace function public.walkthrough_session()
returns table (
  is_walkthrough boolean,
  enabled boolean,
  subject_name text,
  place text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  select * into v_profile
  from public.profiles
  where id = auth.uid();

  if v_profile.id is null or not v_profile.is_walkthrough then
    return query select false, false, ''::text, ''::text;
    return;
  end if;

  return query
  select
    true,
    coalesce((select s.walkthrough_enabled from public.app_settings s where s.id = 1), false),
    coalesce(nullif(trim(v_profile.walkthrough_subject_name), ''), ''),
    coalesce(nullif(trim(v_profile.walkthrough_place), ''), '');
end;
$$;

revoke all on function public.walkthrough_session() from public, anon;
grant execute on function public.walkthrough_session() to authenticated;

create or replace function public.list_walkthrough_accounts(p_role public.app_role)
returns table (
  user_id uuid,
  display_name text,
  college_name text,
  organization_name text,
  program text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.walkthrough_caller_allowed() then
    raise exception 'Walkthrough is turned off.';
  end if;
  if p_role in ('admin', 'student') then
    raise exception 'That role cannot be opened.';
  end if;

  return query
  select
    ur.user_id,
    coalesce(nullif(trim(p.display_name), ''), 'Unnamed account')::text as display_name,
    coalesce(nullif(trim(c.name), ''), '')::text as college_name,
    coalesce(nullif(trim(o.name), ''), '')::text as organization_name,
    coalesce(nullif(trim(s.program), ''), '')::text as program
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  left join public.colleges c on c.id = p.college_id
  left join public.organizations o on o.id = p.organization_id
  left join public.students s
    on p.student_id is not null
    and upper(trim(s.student_id)) = upper(trim(p.student_id))
    and not s.archived
  where ur.role = p_role
    and p.is_walkthrough = false
  order by 2, 3, 4;
end;
$$;

revoke all on function public.list_walkthrough_accounts(public.app_role) from public, anon;
grant execute on function public.list_walkthrough_accounts(public.app_role) to authenticated;

create or replace function public.open_walkthrough_portal(p_user_id uuid)
returns table (
  role public.app_role,
  college_id uuid,
  organization_id uuid,
  subject_name text,
  place text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_role public.app_role;
  v_college uuid;
  v_org uuid;
  v_name text;
  v_college_name text;
  v_org_name text;
  v_program text;
  v_place text;
begin
  if not public.walkthrough_caller_allowed() then
    raise exception 'Walkthrough is turned off.';
  end if;
  if p_user_id is null or p_user_id = auth.uid() then
    raise exception 'Choose an account.';
  end if;

  select ur.role, p.college_id, p.organization_id,
         coalesce(nullif(trim(p.display_name), ''), 'Unnamed account'),
         coalesce(nullif(trim(c.name), ''), ''),
         coalesce(nullif(trim(o.name), ''), ''),
         coalesce(nullif(trim(s.program), ''), '')
    into v_role, v_college, v_org, v_name, v_college_name, v_org_name, v_program
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  left join public.colleges c on c.id = p.college_id
  left join public.organizations o on o.id = p.organization_id
  left join public.students s
    on p.student_id is not null
    and upper(trim(s.student_id)) = upper(trim(p.student_id))
    and not s.archived
  where ur.user_id = p_user_id
    and p.is_walkthrough = false;

  if v_role is null or v_role in ('admin', 'student') then
    raise exception 'That account cannot be opened.';
  end if;

  v_place := nullif(
    concat_ws(' · ',
      nullif(v_college_name, ''),
      nullif(v_org_name, ''),
      nullif(v_program, '')
    ),
    ''
  );

  perform set_config('app.walkthrough_assign', 'on', true);

  update public.profiles
  set college_id = v_college,
      organization_id = v_org,
      walkthrough_subject_name = v_name,
      walkthrough_place = v_place
  where id = auth.uid()
    and is_walkthrough;

  insert into public.user_roles (user_id, role)
  values (auth.uid(), v_role)
  on conflict (user_id) do update
  set role = excluded.role;

  return query
  select v_role, v_college, v_org, v_name, coalesce(v_place, '');
end;
$$;

revoke all on function public.open_walkthrough_portal(uuid) from public, anon;
grant execute on function public.open_walkthrough_portal(uuid) to authenticated;

create or replace function public.app_settings_walkthrough_sync()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE'
     and old.walkthrough_enabled is true
     and new.walkthrough_enabled is false then
    perform set_config('app.walkthrough_assign', 'on', true);
    update public.profiles
    set college_id = null,
        organization_id = null,
        walkthrough_subject_name = null,
        walkthrough_place = null
    where is_walkthrough;
    delete from public.user_roles ur
    using public.profiles p
    where ur.user_id = p.id
      and p.is_walkthrough;
  end if;
  return new;
end;
$$;

drop trigger if exists app_settings_walkthrough_sync on public.app_settings;
create trigger app_settings_walkthrough_sync
after update on public.app_settings
for each row execute function public.app_settings_walkthrough_sync();

revoke all on function public.app_settings_walkthrough_sync() from public, anon, authenticated;
