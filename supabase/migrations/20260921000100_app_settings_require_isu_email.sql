-- Singleton application settings. Admin-only read/write via RLS.
-- Edge Functions using the service role bypass RLS and remain the enforcement point
-- for Admin-created account emails.
-- Idempotent: the remote project may already have public.app_settings and its guard trigger.

create table if not exists public.app_settings (
  id smallint primary key default 1 check (id = 1),
  require_isu_email boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.app_settings
  add column if not exists require_isu_email boolean not null default true;

alter table public.app_settings
  add column if not exists updated_at timestamptz not null default now();

comment on table public.app_settings is
  'Single-row EventLink application settings. require_isu_email gates Admin-provisioned account emails.';

create or replace function public.app_settings_guard()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Application settings cannot be deleted.';
  end if;
  if tg_op = 'INSERT' then
    raise exception 'Application settings already exist.';
  end if;
  if new.id is distinct from 1 then
    raise exception 'Application settings id cannot change.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists app_settings_guard on public.app_settings;

insert into public.app_settings (id, require_isu_email)
values (1, true)
on conflict (id) do nothing;

create trigger app_settings_guard
before insert or update or delete on public.app_settings
for each row execute function public.app_settings_guard();

alter table public.app_settings enable row level security;

drop policy if exists app_settings_admin_select on public.app_settings;
create policy app_settings_admin_select
  on public.app_settings
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists app_settings_admin_update on public.app_settings;
create policy app_settings_admin_update
  on public.app_settings
  for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

revoke all on table public.app_settings from public, anon;
revoke all on function public.app_settings_guard() from public, anon, authenticated;
grant select, update on table public.app_settings to authenticated;
