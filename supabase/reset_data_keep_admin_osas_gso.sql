-- =============================================================================
-- Wipe EventLink DATA. Keep only these Auth logins (and their roles/profiles):
--   ja.d.miguel@isu.edu.ph  (admin)
--   gso@isu.edu.ph          (gso)
--   osas@isu.edu.ph         (osas)
--
-- Run in: Supabase Dashboard → SQL Editor → paste → Run
-- Do NOT run reset_data_keep_admin.sql (that keeps admin only).
-- Do NOT run reset_public_schema.sql (that drops tables).
--
-- Passwords are not in this file. Existing Auth passwords stay as they are.
-- =============================================================================

do $$
declare
  keep_emails text[] := array[
    'ja.d.miguel@isu.edu.ph',
    'gso@isu.edu.ph',
    'osas@isu.edu.ph'
  ];
  keep_ids uuid[];
  tbl text;
  rec record;
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
  catalog_tables text[] := array[
    'students',
    'organizations',
    'colleges',
    'venues',
    'equipment'
  ];
begin
  select coalesce(array_agg(id), '{}')
    into keep_ids
  from auth.users
  where lower(email) in (
    'ja.d.miguel@isu.edu.ph',
    'gso@isu.edu.ph',
    'osas@isu.edu.ph'
  );

  if cardinality(keep_ids) < 3 then
    raise exception
      'Expected 3 Auth users (admin, GSO, OSAS). Found %. Check emails in Authentication → Users before running again.',
      cardinality(keep_ids);
  end if;

  delete from public.user_roles where not (user_id = any (keep_ids));
  delete from public.profiles where not (id = any (keep_ids));

  update public.profiles
  set
    student_id = null,
    college_id = null,
    organization_id = null
  where id = any (keep_ids);

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

  -- DELETE, not TRUNCATE: profiles still has FKs to students/colleges/organizations
  -- even after those columns are set to null. TRUNCATE refuses that (0A000).
  -- CASCADE would also wipe the kept admin/GSO/OSAS profile rows.
  foreach tbl in array catalog_tables
  loop
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = tbl
    ) then
      execute format('delete from public.%I', tbl);
    end if;
  end loop;

  delete from auth.users where not (id = any (keep_ids));

  -- Direct DELETE on storage.objects is blocked (protect_delete). Use Storage SQL API.
  begin
    if to_regprocedure('storage.delete_object(text, text)') is not null then
      for rec in select bucket_id, name from storage.objects
      loop
        perform storage.delete_object(rec.bucket_id, rec.name);
      end loop;
    else
      raise notice 'storage.delete_object() is not available. Empty buckets in Dashboard → Storage.';
    end if;
  exception
    when others then
      raise notice
        'Could not empty Storage automatically (%). Empty each bucket in Dashboard → Storage. Auth and table reset still succeeded.',
        sqlerrm;
  end;

  raise notice 'Reset complete. Kept admin, GSO, and OSAS. All events and other users were removed.';
end $$;
