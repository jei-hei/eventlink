-- Admin switch for creating more than one account in the same role.
-- Default off keeps the existing one-OSAS, one-EO, one-GSO, one-Dean-per-college,
-- and one-Adviser-per-organization import limits.

alter table public.app_settings
  add column if not exists allow_multiple_accounts boolean not null default false;

comment on column public.app_settings.allow_multiple_accounts is
  'When true, Admin may create more than one account for the same role, college, or organization. When false, OSAS, EO, and GSO stay limited to one account, each college to one Dean, and each organization to one Adviser on import.';
