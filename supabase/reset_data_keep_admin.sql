-- =============================================================================
-- EventLink / Supabase: wipe application DATA, keep schema + one admin login.
--
-- Use this when you want an empty app so you can enter real colleges, orgs,
-- students, staff, and events from the Admin UI.
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Paste this file → Run
--
-- This is NOT reset_public_schema.sql. That file drops tables and RLS.
-- This file keeps migrations, functions, policies, and storage buckets.
--
-- Keeps:
--   - public schema / tables / RLS / RPCs
--   - one auth.users row (the admin email below)
--   - that user's public.user_roles (admin) and public.profiles row
--   - storage buckets (files inside them are deleted)
--
-- Deletes:
--   - events, history, letters, feedback, feed posts, notifications
--   - students, organizations, colleges, venues, equipment
--   - every other Auth user
--   - every other profile / portal role
--   - uploaded files in Storage
--
-- After this, do NOT run seed/01_students.sql or `npm run seed:staff`
-- unless you want demo accounts again. Log in as admin and create real data.
--
-- If the admin Auth user is missing afterward:
--   cd app && npm run seed:admin
-- =============================================================================

do $$
declare
  -- Change this if your admin login is not the seed default.
  admin_email text := 'admin@eventlink.local';
  admin_id uuid;
  tbl text;
  -- Truncate with CASCADE is safe here: these do not point at profiles.
  event_tables text[] := array[
    'event_request_equipment',
    'event_request_history',
    'event_request_letters',
    'event_request_compliance_comments',
    'event_request_resource_assignments',
    'event_venue_reservations',
    'event_equipment_reservations',
    'event_request_upload_intents',
    'event_feedback',
    'event_feedback_legacy_archive',
    'student_feed_posts',
    'notifications',
    'notification_email_outbox',
    'event_requests',
    'rate_limit_buckets'
  ];
  -- Do NOT CASCADE these: profiles.college_id / organization_id / student_id
  -- would wipe the admin profile.
  catalog_tables text[] := array[
    'students',
    'organizations',
    'colleges',
    'venues',
    'equipment'
  ];
begin
  select id
    into admin_id
  from auth.users
  where lower(email) = lower(admin_email)
  limit 1;

  if admin_id is null then
    select ur.user_id
      into admin_id
    from public.user_roles ur
    where ur.role = 'admin'
    order by ur.user_id
    limit 1;
  end if;

  if admin_id is null then
    raise exception
      'No admin Auth user found for %. Create one with `npm run seed:admin` first, or edit admin_email in this script.',
      admin_email;
  end if;

  delete from public.user_roles where user_id <> admin_id;
  delete from public.profiles where id <> admin_id;

  -- Drop catalog FKs from the surviving admin profile so those tables can truncate.
  update public.profiles
  set
    student_id = null,
    college_id = null,
    organization_id = null
  where id = admin_id;

  foreach tbl in array event_tables
  loop
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = tbl
    ) then
      execute format('truncate table public.%I restart identity cascade', tbl);
    end if;
  end loop;

  foreach tbl in array catalog_tables
  loop
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = tbl
    ) then
      execute format('truncate table public.%I restart identity', tbl);
    end if;
  end loop;

  insert into public.user_roles (user_id, role)
  values (admin_id, 'admin')
  on conflict (user_id) do update set role = 'admin';

  insert into public.profiles (id, display_name, email)
  values (
    admin_id,
    'Admin User',
    coalesce(
      (select email from auth.users where id = admin_id),
      admin_email
    )
  )
  on conflict (id) do update
    set display_name = excluded.display_name,
        email = excluded.email;

  delete from auth.users where id <> admin_id;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage'
      and table_name = 'objects'
  ) then
    delete from storage.objects;
  end if;

  raise notice 'Reset complete. Kept admin user % (%).', admin_id, admin_email;
end $$;
