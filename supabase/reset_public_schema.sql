-- =============================================================================
-- EventLink / Supabase: wipe ALL objects in the `public` schema (tables,
-- views, functions, types, etc.) and recreate an empty `public` schema.
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Paste → Run
--
-- WARNING:
-- - This deletes ALL application data in `public` (profiles, events, …).
-- - It does NOT delete rows in auth.users (accounts still exist; you can
--   remove users manually under Authentication → Users if you want).
-- - It does NOT remove Storage buckets/files (delete in Dashboard → Storage).
-- - After this, re-apply your migrations or run `schema.sql` again.
-- =============================================================================

-- 1) Remove auth trigger that calls into public (safe before dropping public)
drop trigger if exists on_auth_user_created_eventlink on auth.users;

-- 2) Nuclear reset of everything in `public`
drop schema if exists public cascade;

-- 3) Recreate `public` the way Supabase expects
create schema public;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to postgres, anon, authenticated, service_role;

-- Optional: re-enable extensions you rely on (harmless if already present)
create extension if not exists "pgcrypto";

-- Next step: run your full `schema.sql` (or migrations) to recreate tables,
-- RLS, triggers, and seed data.
