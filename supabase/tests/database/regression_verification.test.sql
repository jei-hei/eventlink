-- Regression contract for the security and workflow hardening migrations.
-- Run only against a disposable local database after all migrations are applied:
--   supabase db reset
--   supabase test db

begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.function_execute_granted(
  function_signature text,
  grantee_name name
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from pg_proc p
    cross join lateral aclexplode(
      coalesce(p.proacl, acldefault('f', p.proowner))
    ) acl
    where p.oid = to_regprocedure(function_signature)
      and acl.privilege_type = 'EXECUTE'
      and acl.grantee = case
        when grantee_name = 'PUBLIC' then 0::oid
        else (select r.oid from pg_roles r where r.rolname = grantee_name)
      end
  );
$$;

create function pg_temp.table_privilege_granted(
  table_name regclass,
  grantee_name name,
  requested_privilege text
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from pg_class c
    cross join lateral aclexplode(
      coalesce(c.relacl, acldefault(case when c.relkind = 'S' then 's' else 'r' end, c.relowner))
    ) acl
    where c.oid = table_name
      and acl.privilege_type = upper(requested_privilege)
      and acl.grantee = case
        when grantee_name = 'PUBLIC' then 0::oid
        else (select r.oid from pg_roles r where r.rolname = grantee_name)
      end
  );
$$;

-- ---------------------------------------------------------------------------
-- Portal roles and RLS intent
-- ---------------------------------------------------------------------------
select is(
  (
    select array_agg(e.enumlabel order by e.enumlabel)
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'app_role'
      and e.enumlabel <> 'student'
  ),
  array[
    'admin', 'adviser', 'dean', 'eo', 'gso', 'infirmary', 'it_infrastructure',
    'nstp', 'osas', 'sports_office', 'ssc', 'student_officer'
  ]::text[],
  'app_role exposes exactly the 12 active portal role literals'
);

select is(
  obj_description('public.app_role'::regtype, 'pg_type'),
  'Portal roles. Value `student` is deprecated — public event viewing no longer requires an account.',
  'legacy student enum value is explicitly deprecated'
);

select ok(
  (
    with role_names(role_name) as (
      values
        ('student_officer'), ('ssc'), ('adviser'), ('dean'), ('osas'), ('eo'),
        ('gso'), ('it_infrastructure'), ('sports_office'), ('infirmary'),
        ('nstp'), ('admin')
    ),
    helper_source as (
      select
        pg_get_functiondef('public.can_view_event_request(uuid)'::regprocedure)
        || pg_get_functiondef('public.can_access_event_request_details(uuid)'::regprocedure)
        as body
    )
    select bool_and(position(quote_literal(role_name) in body) > 0)
    from role_names
    cross join helper_source
  ),
  'request visibility helpers account for every active portal role'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'event_requests'
      and policyname = 'event_requests_select_scoped'
      and cmd = 'SELECT'
      and roles @> array['authenticated']::name[]
      and qual like '%can_view_event_request(id)%'
  ),
  'authenticated event request reads use the scoped visibility helper'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'event_requests'
      and policyname = 'event_requests_select_posted_public'
      and cmd = 'SELECT'
      and roles @> array['anon']::name[]
      and qual like '%deleted_at IS NULL%'
      and qual like '%student_feed_posts%'
  ),
  'anonymous request visibility is limited to non-deleted public/feed events'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'event_feedback'
      and policyname = 'event_feedback_select_scoped'
      and cmd = 'SELECT'
      and qual like '%can_access_event_request_details%'
  ),
  'feedback reads retain request-detail scope'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in ('event_venue_reservations', 'event_equipment_reservations')
      and cmd = 'SELECT'
      and roles @> array['authenticated']::name[]
      and qual like '%can_access_event_request_details(request_id)%'
    group by schemaname
    having count(*) = 2
  ),
  'both reservation ledgers use request-detail visibility'
);

-- ---------------------------------------------------------------------------
-- Anonymous/public exposure and direct mutation boundaries
-- ---------------------------------------------------------------------------
select ok(
  not has_table_privilege('anon', 'public.event_requests', 'SELECT')
  and (
    select bool_and(has_column_privilege('anon', 'public.event_requests', column_name, 'SELECT'))
    from unnest(array[
      'id', 'activity', 'start_date', 'end_date', 'start_time', 'end_time',
      'venue', 'status', 'posted_at', 'calendar_posted_at', 'organization_id',
      'request_type'
    ]) as safe_columns(column_name)
  )
  and not has_column_privilege('anon', 'public.event_requests', 'letter_path', 'SELECT')
  and not has_column_privilege('anon', 'public.event_requests', 'submitted_by', 'SELECT'),
  'anon receives only the public-safe event request projection'
);

select ok(
  not has_column_privilege('anon', 'public.student_feed_posts', 'feedback_access_code_hash', 'SELECT')
  and not has_column_privilege('authenticated', 'public.student_feed_posts', 'feedback_access_code_hash', 'SELECT')
  and not exists (
    select 1
    from pg_attribute a
    cross join lateral aclexplode(coalesce(a.attacl, '{}'::aclitem[])) acl
    where a.attrelid = 'public.student_feed_posts'::regclass
      and a.attname = 'feedback_access_code_hash'
      and acl.grantee = 0
      and acl.privilege_type = 'SELECT'
  ),
  'feedback access-code hashes are not client-readable'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'student_feed_posts'
      and policyname = 'student_feed_posts_select_public'
      and cmd = 'SELECT'
  )
  and exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'organizations'
      and policyname = 'organizations_select_public'
      and cmd = 'SELECT'
  )
  and exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'colleges'
      and policyname = 'colleges_select_public'
      and cmd = 'SELECT'
  ),
  'anonymous public-feed reads retain explicit RLS policies'
);

select ok(
  (
    with protected_tables(table_name) as (
      values
        ('event_requests'),
        ('event_request_resource_assignments'),
        ('event_request_equipment'),
        ('event_request_history'),
        ('event_venue_reservations'),
        ('event_equipment_reservations')
    ),
    client_roles(role_name) as (values ('anon'), ('authenticated')),
    mutations(privilege_name) as (values ('INSERT'), ('UPDATE'), ('DELETE'))
    select bool_and(
      not has_table_privilege(
        role_name,
        format('public.%I', table_name),
        privilege_name
      )
    )
    from protected_tables
    cross join client_roles
    cross join mutations
  ),
  'clients cannot directly mutate workflow, history, or reservation tables'
);

select ok(
  has_column_privilege('authenticated', 'public.event_requests', 'letter_path', 'UPDATE')
  and has_column_privilege('authenticated', 'public.event_requests', 'original_letter_path', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.event_requests', 'status', 'UPDATE'),
  'authenticated direct request updates are restricted to proposal path columns'
);

select ok(
  not has_table_privilege('anon', 'public.event_feedback', 'INSERT')
  and not has_table_privilege('authenticated', 'public.event_feedback', 'INSERT')
  and not has_table_privilege('anon', 'public.event_feedback', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.event_feedback', 'UPDATE'),
  'public feedback cannot bypass the server-authoritative RPC'
);

select ok(
  not has_table_privilege('anon', 'public.notifications', 'INSERT')
  and not has_table_privilege('authenticated', 'public.notifications', 'INSERT')
  and not has_table_privilege('anon', 'public.notifications', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.notifications', 'UPDATE')
  and not has_table_privilege('anon', 'public.notifications', 'DELETE')
  and not has_table_privilege('authenticated', 'public.notifications', 'DELETE')
  and not has_column_privilege('authenticated', 'public.notifications', 'title', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.notifications', 'body', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.notifications', 'read_at', 'UPDATE'),
  'notification clients have no direct mutation privileges'
);

select ok(
  not pg_temp.table_privilege_granted(
    'public.notification_email_outbox', 'PUBLIC', 'SELECT'
  )
  and not has_table_privilege('anon', 'public.notification_email_outbox', 'SELECT')
  and not has_table_privilege('authenticated', 'public.notification_email_outbox', 'SELECT'),
  'notification outbox is hidden from client roles'
);

-- ---------------------------------------------------------------------------
-- Security-definer RPC signatures and execute grants
-- ---------------------------------------------------------------------------
select ok(
  (
    with client_rpc(signature, anon_allowed, authenticated_allowed) as (
      values
        ('public.ensure_my_profile()', false, true),
        ('public.get_user_role(uuid)', false, true),
        ('public.has_role(uuid,public.app_role)', false, true),
        ('public.can_view_event_request(uuid)', false, true),
        ('public.can_access_event_request_details(uuid)', false, true),
        ('public.can_view_event_request_audit(uuid)', false, true),
        ('public.get_public_feed_author_profiles(uuid[])', true, true),
        ('public.verify_student_registry(text)', true, true),
        ('public.get_student_registry_row(text)', true, true),
        ('public.check_venue_availability(text,date,date,uuid)', false, true),
        ('public.check_venue_availability(text,date,date,uuid,time without time zone,time without time zone)', false, true),
        ('public.check_rate_limit(text,text,integer,integer)', true, true)
    )
    select bool_and(
      to_regprocedure(signature) is not null
      and not pg_temp.function_execute_granted(signature, 'PUBLIC')
      and pg_temp.function_execute_granted(signature, 'anon') = anon_allowed
      and pg_temp.function_execute_granted(signature, 'authenticated') = authenticated_allowed
    )
    from client_rpc
  ),
  'shared security-definer helpers have explicit least-privilege execute grants'
);

select ok(
  to_regprocedure(
    'public.eo_event_log_page(date,date,uuid,uuid,text,text,text,text,integer,integer)'
  ) is not null
  and pg_temp.function_execute_granted(
    'public.eo_event_log_page(date,date,uuid,uuid,text,text,text,text,integer,integer)',
    'authenticated'
  )
  and not pg_temp.function_execute_granted(
    'public.eo_event_log_page(date,date,uuid,uuid,text,text,text,text,integer,integer)',
    'PUBLIC'
  )
  and not pg_temp.function_execute_granted(
    'public.eo_event_log_page(date,date,uuid,uuid,text,text,text,text,integer,integer)',
    'anon'
  ),
  'EO Event Log projection has an authenticated-only execute grant'
);

select ok(
  (
    select p.prosecdef
      and array_to_string(p.proconfig, ',') like '%search_path=pg_catalog, public%'
      and position(
        'not public.has_role(auth.uid(), ''eo''::public.app_role)'
        in pg_get_functiondef(p.oid)
      ) > 0
      and position('p.office' in pg_get_functiondef(p.oid)) > 0
      and position('count(*) from filtered' in lower(pg_get_functiondef(p.oid))) > 0
    from pg_proc p
    where p.oid = to_regprocedure(
      'public.eo_event_log_page(date,date,uuid,uuid,text,text,text,text,integer,integer)'
    )
  ),
  'EO Event Log projection fixes search_path, checks EO role, and filters before counting'
);

select ok(
  (
    with workflow_rpc(signature) as (
      values
        ('public.prepare_event_request_upload(uuid)'),
        ('public.has_event_request_upload_intent(uuid)'),
        ('public.create_event_request_transactional(uuid,jsonb,text,jsonb)'),
        ('public.event_workflow_decide(uuid,text,text,text,text)'),
        ('public.eo_forward_event_request(uuid,jsonb)'),
        ('public.event_resource_notification_recipients(uuid,public.resource_office)'),
        ('public.resource_office_decide_event_request(uuid,text,text)'),
        ('public.event_request_lifecycle(uuid,text,text,text,text)'),
        ('public.update_event_request_transactional(uuid,jsonb,boolean,text)'),
        ('public.enqueue_notification(uuid,text,uuid,text,jsonb)'),
        ('public.mark_notification_read(uuid)'),
        ('public.mark_all_notifications_read()'),
        ('public.can_delete_event_letter_upload(text)')
    )
    select bool_and(
      to_regprocedure(signature) is not null
      and not pg_temp.function_execute_granted(signature, 'PUBLIC')
      and not pg_temp.function_execute_granted(signature, 'anon')
      and pg_temp.function_execute_granted(signature, 'authenticated')
    )
    from workflow_rpc
  ),
  'workflow RPCs exist with exact signatures and authenticated-only execution'
);

select ok(
  (
    with service_rpc(signature) as (
      values
        ('public.verify_feedback_access_code(uuid,text)'),
        ('public.verify_public_feedback_access_server(uuid,text,text)'),
        ('public.submit_public_event_feedback_server(uuid,smallint,text,text[],text,text)'),
        ('public.claim_notification_email_delivery(uuid,uuid)'),
        ('public.claim_notification_email_batch(integer)'),
        ('public.finish_notification_email_delivery(uuid,boolean,text)')
    )
    select bool_and(
      to_regprocedure(signature) is not null
      and pg_temp.function_execute_granted(signature, 'service_role')
      and not pg_temp.function_execute_granted(signature, 'PUBLIC')
      and not pg_temp.function_execute_granted(signature, 'anon')
      and not pg_temp.function_execute_granted(signature, 'authenticated')
    )
    from service_rpc
  ),
  'feedback and delivery internals are service-role-only'
);

select ok(
  (
    with internal_rpc(signature) as (
      values
        ('public.consume_server_rate_limit(text,text,integer,integer)'),
        ('public.can_enqueue_request_notification(uuid,uuid)'),
        ('public.release_event_resources(uuid,text)'),
        ('public.reserve_event_venue(public.event_requests,uuid)'),
        ('public.event_request_actor_can_handle(public.event_requests,uuid,public.app_role)')
    )
    select bool_and(
      to_regprocedure(signature) is not null
      and not pg_temp.function_execute_granted(signature, 'PUBLIC')
      and not pg_temp.function_execute_granted(signature, 'anon')
      and not pg_temp.function_execute_granted(signature, 'authenticated')
    )
    from internal_rpc
  ),
  'internal security-definer helpers are not executable by client roles'
);

-- ---------------------------------------------------------------------------
-- Fixed rate limits and feedback invariants
-- ---------------------------------------------------------------------------
select ok(
  (
    with expected(action, max_attempts, window_seconds) as (
      values
        ('login', 8, 900),
        ('password_reset', 5, 900),
        ('event_submit', 10, 60),
        ('event_mutate', 30, 30),
        ('feedback_submit', 12, 60),
        ('file_upload', 15, 60),
        ('search', 40, 10),
        ('student_registry_verify', 12, 900),
        ('student_registry_lookup', 6, 900)
    ),
    source as (
      select pg_get_functiondef(
        'public.check_rate_limit(text,text,integer,integer)'::regprocedure
      ) as body
    )
    select bool_and(
      position(
        format('(%L, %s, %s)', action, max_attempts, window_seconds)
        in body
      ) > 0
    )
    from expected
    cross join source
  ),
  'client rate-limit RPC retains every fixed action and server-selected threshold'
);

select is(
  public.check_rate_limit('__unsupported_regression_action__', null, 200, 5),
  false,
  'unknown client rate-limit actions fail closed'
);

select ok(
  not (
    select attnotnull
    from pg_attribute
    where attrelid = 'public.event_feedback'::regclass
      and attname = 'request_id'
      and not attisdropped
  )
  and not (
    select attnotnull
    from pg_attribute
    where attrelid = 'public.event_feedback'::regclass
      and attname = 'feed_post_id'
      and not attisdropped
  )
  and to_regclass('public.event_feedback_legacy_archive') is not null,
  'legacy feedback remains nullable and unresolved rows have a protected archive'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.event_feedback'::regclass
      and conname = 'event_feedback_feed_post_request_fkey'
      and contype = 'f'
      and confrelid = 'public.student_feed_posts'::regclass
      and not convalidated
      and pg_get_constraintdef(oid) like '%FOREIGN KEY (feed_post_id, request_id)%'
  ),
  'new feedback linkage uses a nullable-compatible composite foreign key'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.event_feedback'::regclass
      and tgname = 'enforce_event_feedback_target'
      and not tgisinternal
      and tgenabled <> 'D'
  ),
  'feedback target invariant trigger is enabled'
);

select ok(
  position(
    'v_post.request_id, p_rating, v_comment, v_tags'
    in pg_get_functiondef(
      'public.submit_public_event_feedback_server(uuid,smallint,text,text[],text,text)'::regprocedure
    )
  ) > 0,
  'feedback server RPC derives request_id from the feed post'
);

select ok(
  (
    select
      position('p_rating is null or p_rating not between 1 and 5' in body) > 0
      and position('length(v_comment) > 1000' in body) > 0
      and position('left(trim(value), 80)' in body) > 0
      and position('limit 20' in lower(body)) > 0
      and position('is_event_schedule_completed' in body) > 0
      and position('feedback_access_code_hash is distinct from p_access_code_hash' in body) > 0
    from (
      select pg_get_functiondef(
        'public.submit_public_event_feedback_server(uuid,smallint,text,text[],text,text)'::regprocedure
      ) as body
    ) source
  ),
  'feedback RPC enforces rating, comment, tag, completion, and access-code invariants'
);

select ok(
  not pg_temp.function_execute_granted(
    'public.submit_public_event_feedback(uuid,smallint,text,text[],uuid,text)',
    'PUBLIC'
  )
  and not pg_temp.function_execute_granted(
    'public.submit_public_event_feedback(uuid,smallint,text,text[],uuid,text)',
    'anon'
  )
  and not pg_temp.function_execute_granted(
    'public.submit_public_event_feedback(uuid,smallint,text,text[],uuid,text)',
    'authenticated'
  ),
  'legacy caller-supplied request-id feedback RPC fails closed'
);

-- ---------------------------------------------------------------------------
-- Notification deduplication and server-selected templates
-- ---------------------------------------------------------------------------
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'notifications'
      and indexname = 'notifications_user_dedup_idx'
      and indexdef like '%UNIQUE INDEX%'
      and indexdef like '%(user_id, dedup_key)%'
      and indexdef like '%WHERE (dedup_key IS NOT NULL)%'
  ),
  'notifications have a partial unique recipient/dedup key index'
);

select ok(
  (
    with expected(event_type) as (
      values
        ('login_detected'),
        ('request_submitted'),
        ('request_approved'),
        ('sent_to_resource_offices'),
        ('resource_review_required'),
        ('event_scheduled'),
        ('resource_declined'),
        ('request_declined'),
        ('published_student_feed'),
        ('published_staff_calendar'),
        ('event_cancelled'),
        ('revision_requested'),
        ('schedule_updated'),
        ('request_resubmitted')
    ),
    source as (
      select pg_get_functiondef(
        'public.enqueue_notification(uuid,text,uuid,text,jsonb)'::regprocedure
      ) as body
    )
    select bool_and(position(quote_literal(event_type) in body) > 0)
    from expected
    cross join source
  ),
  'notification enqueue retains the fixed event-template allowlist'
);

select ok(
  (
    select
      position('A stable notification deduplication key is required.' in body) > 0
      and position('Invalid notification context.' in body) > 0
      and position('p_context ->> ''title''' in body) = 0
      and position('p_context ->> ''body''' in body) = 0
    from (
      select pg_get_functiondef(
        'public.enqueue_notification(uuid,text,uuid,text,jsonb)'::regprocedure
      ) as body
    ) source
  ),
  'notification dedup keys are mandatory and callers cannot inject templates'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.notification_email_outbox'::regclass
      and conname = 'notification_email_outbox_status_check'
      and pg_get_constraintdef(oid) like '%pending%'
      and pg_get_constraintdef(oid) like '%exhausted%'
      and pg_get_constraintdef(oid) like '%skipped%'
  )
  and exists (
    select 1
    from pg_constraint
    where conrelid = 'public.notification_email_outbox'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%attempt_count >= 0%'
      and pg_get_constraintdef(oid) like '%attempt_count <= 5%'
  ),
  'notification outbox constrains delivery states and retry count'
);

-- ---------------------------------------------------------------------------
-- Storage limits and policy shape
-- ---------------------------------------------------------------------------
select ok(
  (
    with expected(bucket_id, is_public, byte_limit, mime_types) as (
      values
        ('event-letters', false, 10485760::bigint, array['application/pdf']::text[]),
        (
          'event-post-images', true, 8388608::bigint,
          array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
        ),
        (
          'profile-avatars', true, 5242880::bigint,
          array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
        ),
        (
          'compliance-attachments', false, 10485760::bigint,
          array[
            'image/png', 'image/jpeg', 'image/gif', 'image/webp',
            'application/pdf', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain'
          ]::text[]
        )
    )
    select bool_and(
      b.id is not null
      and b.public = expected.is_public
      and b.file_size_limit = expected.byte_limit
      and b.allowed_mime_types = expected.mime_types
    )
    from expected
    left join storage.buckets b on b.id = expected.bucket_id
  ),
  'all four storage buckets retain exact visibility, size, and MIME limits'
);

select ok(
  (
    with expected(policy_name, command_name, bucket_name) as (
      values
        ('event_letters_insert_authenticated', 'INSERT', 'event-letters'),
        ('event_post_images_insert_own', 'INSERT', 'event-post-images'),
        ('event_post_images_update_own', 'UPDATE', 'event-post-images'),
        ('profile_avatars_insert_own', 'INSERT', 'profile-avatars'),
        ('profile_avatars_update_own', 'UPDATE', 'profile-avatars'),
        ('compliance_attachments_insert_authenticated', 'INSERT', 'compliance-attachments'),
        ('compliance_attachments_update_own', 'UPDATE', 'compliance-attachments')
    )
    select bool_and(
      p.policyname is not null
      and p.roles @> array['authenticated']::name[]
      and coalesce(p.qual, '') || coalesce(p.with_check, '') like
        '%' || quote_literal(expected.bucket_name) || '%'
      and coalesce(p.qual, '') || coalesce(p.with_check, '') like '%auth.uid()%'
    )
    from expected
    left join pg_policies p
      on p.schemaname = 'storage'
     and p.tablename = 'objects'
     and p.policyname = expected.policy_name
     and p.cmd = expected.command_name
  ),
  'storage write policies are authenticated, bucket-bound, and owner-bound'
);

select ok(
  (
    with expected(policy_name, command_name, bucket_name) as (
      values
        ('event_letters_select_authenticated', 'SELECT', 'event-letters'),
        ('event_letters_delete_unsubmitted_own', 'DELETE', 'event-letters'),
        ('event_post_images_select_public', 'SELECT', 'event-post-images'),
        ('profile_avatars_select_public', 'SELECT', 'profile-avatars'),
        ('profile_avatars_delete_own', 'DELETE', 'profile-avatars'),
        ('compliance_attachments_select_authenticated', 'SELECT', 'compliance-attachments')
    )
    select bool_and(
      p.policyname is not null
      and coalesce(p.qual, '') like '%' || quote_literal(expected.bucket_name) || '%'
      and (
        expected.command_name <> 'DELETE'
        or (
          p.roles @> array['authenticated']::name[]
          and (
            p.qual like '%auth.uid()%'
            or (
              expected.policy_name = 'event_letters_delete_unsubmitted_own'
              and p.qual like '%can_delete_event_letter_upload%'
            )
          )
        )
      )
    )
    from expected
    left join pg_policies p
      on p.schemaname = 'storage'
     and p.tablename = 'objects'
     and p.policyname = expected.policy_name
     and p.cmd = expected.command_name
  ),
  'storage read and delete policies retain bucket and owner boundaries'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'event_letters_insert_authenticated'
      and with_check like '%has_event_request_upload_intent%'
  )
  and exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'compliance_attachments_insert_authenticated'
      and with_check like '%can_view_event_request_audit%'
  ),
  'request-bound storage uploads verify upload intent or audit access'
);

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in ('event_letters_delete_own', 'event_letters_update_own')
  )
  and exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'event_letters_delete_unsubmitted_own'
      and cmd = 'DELETE'
      and qual like '%can_delete_event_letter_upload%'
  )
  and position(
    'event_request_letters'
    in pg_get_functiondef('public.can_delete_event_letter_upload(text)'::regprocedure)
  ) > 0,
  'submitted proposal objects cannot be replaced or directly deleted'
);

-- ---------------------------------------------------------------------------
-- Reservation integrity
-- ---------------------------------------------------------------------------
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.event_venue_reservations'::regclass
      and conname = 'event_venue_reservations_time_check'
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%ends_at > starts_at%'
  ),
  'venue reservations require a positive time range'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.event_venue_reservations'::regclass
      and conname = 'event_venue_reservations_no_overlap'
      and contype = 'x'
      and pg_get_constraintdef(oid) like '%EXCLUDE USING gist%'
      and pg_get_constraintdef(oid) like '%tsrange(starts_at, ends_at%'
  ),
  'active venue reservations use an exclusion constraint against overlap'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'event_venue_reservations'
      and indexname = 'event_venue_reservations_active_request_idx'
      and indexdef like '%UNIQUE INDEX%'
      and indexdef like '%WHERE (released_at IS NULL)%'
  )
  and exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'event_equipment_reservations'
      and indexname = 'event_equipment_reservations_active_item_idx'
      and indexdef like '%UNIQUE INDEX%'
      and indexdef like '%WHERE (released_at IS NULL)%'
  )
  and exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'event_request_resource_assignments'
      and indexname = 'event_request_one_inventory_allocator_idx'
      and indexdef like '%UNIQUE INDEX%'
      and indexdef like '%allocates_inventory%'
  ),
  'partial unique indexes prevent duplicate active reservations and allocations'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.event_equipment_reservations'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%quantity > 0%'
  ),
  'equipment reservation quantities must be positive'
);

select * from finish();
rollback;
