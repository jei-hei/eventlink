-- Single active session support + login metadata on profiles.
alter table public.profiles
  add column if not exists active_session_id text,
  add column if not exists active_session_updated_at timestamptz,
  add column if not exists last_login_metadata jsonb not null default '{}'::jsonb;

create index if not exists profiles_active_session_idx
  on public.profiles (id, active_session_id);
