# Supabase deployment readiness checklist

> Status: **documentation and source tests only**. No migration, database reset,
> pgTAP database test, Edge Function deployment, secret update, or production
> deployment was executed while preparing this checklist.

## 1. Pre-deployment checks

- [ ] Work from a clean, reviewed commit or release branch.
- [ ] Install the Supabase CLI and Docker, then authenticate with `supabase login`.
- [ ] Link the intended project with `supabase link --project-ref <project-ref>`.
- [ ] Confirm the target before every remote command with `supabase projects list`.
- [ ] Back up the remote database and document a restore point.
- [ ] Review existing migration state with `supabase migration list`.
- [ ] Resolve any legacy active venue overlap reported by the transactional workflow
      migration before retrying. Do not mark a conflicting migration as applied.
- [ ] Keep service-role keys, mail credentials, salts, and worker secrets out of git,
      browser bundles, command history, screenshots, and CI logs.

## 2. Database migrations

Apply every SQL file in `supabase/migrations/` in timestamp order. The migration
chain currently consists of these deployment groups:

- [ ] `20260527120000_eventlink_initial.sql`
- [ ] `20260528120000` through `20260529400000` (storage, request workflow,
      public feed, feedback, profiles, and admin directory)
- [ ] `20260530113000` through `20260531012000` (sessions, directory scope,
      request scope, profile/avatar persistence, feed images, and indexes)
- [ ] `20260811000000` and `20260811000100` (resource-office enums and phase 1)
- [ ] `20260819000000` through `20260819000200` (resource assignment and
      cancellation behavior)
- [ ] `20260826000100` through `20260827000100` (revision/compliance,
      feed-author projection, and feedback preservation)
- [ ] `20260906000100` and `20260906000200` (role additions, venue time checks,
      and feedback-code verification)
- [ ] `20260907000100`, `20260907000400`, and `20260907000500` (student-role
      deprecation, resource-office correction, pagination, and rate limiting)
- [ ] `20260908000100` through `20260908000400` (soft delete, audit scope,
      office analytics, and public event projection)
- [ ] `20260909000100_identity_rls.sql`
- [ ] `20260909000200_transactional_event_workflow.sql`
- [ ] `20260909000300_feedback_notifications_storage.sql`
- [ ] `20260909000400_query_projections.sql`

The last four migrations are the regression-verification gate: identity/RLS,
transactional workflow/reservations, feedback/notification/storage hardening,
and the EO-only paginated Event Log projection.

## 3. Environment variables and secrets

Frontend deployment environment:

- [ ] `VITE_SUPABASE_URL` — target project URL.
- [ ] `VITE_SUPABASE_ANON_KEY` — target project's public anon key.
- [ ] `VITE_DEV_SKIP_STAFF_EMAIL_OTP` — unset or `false` in production.

Edge Function secrets set through Supabase (never with real values in this file):

- [ ] `ALLOWED_ORIGINS` — comma-separated exact frontend origins; no wildcard.
- [ ] `RATE_LIMIT_SALT` — independent, high-entropy random value.
- [ ] `RESEND_API_KEY` — key for a verified Resend account/domain.
- [ ] `NOTIFICATION_FROM_EMAIL` — verified sender identity.
- [ ] `OUTBOX_WORKER_SECRET` — independent secret for the scheduled retry worker.

Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` to deployed functions. Do not expose the service-role
key through `VITE_*` variables. Local account-seeding variables (`ADMIN_EMAIL`,
`ADMIN_PASSWORD`, `STAFF_SEED_PASSWORD`, `PORTAL_USER_PASSWORD`, and
`TEST_USER_PASSWORD`) are optional operational inputs, not frontend variables.

Set only the custom Edge Function secrets:

```bash
supabase secrets set ALLOWED_ORIGINS="<exact-origin-list>" RATE_LIMIT_SALT="<random-value>" RESEND_API_KEY="<provider-key>" NOTIFICATION_FROM_EMAIL="<verified-sender>" OUTBOX_WORKER_SECRET="<random-value>"
```

## 4. Exact local verification commands

Run from the repository root. `supabase db reset` is destructive to the local
Supabase database only; confirm that the CLI is targeting local Docker before use.

```bash
supabase start
supabase db reset
supabase migration list
supabase test db
node --test app/tests/source-regressions.test.mjs
cd app
npm ci
npm run type-check
npm run build
```

Expected database test file:
`supabase/tests/database/regression_verification.test.sql`.

- [ ] All migrations apply from an empty local database.
- [ ] `supabase test db` passes the pgTAP regression contract.
- [ ] The seven source regression tests pass.
- [ ] Type checking and the production build pass.
- [ ] Manually smoke-test one account for each of the 12 active portal roles.
- [ ] As anon, verify only public event fields are readable and feedback goes
      through the public Edge Functions.
- [ ] Verify overlapping active venue reservations and over-allocation fail.
- [ ] Verify duplicate notification dedup keys create one notification/outbox row.
- [ ] Verify PDF/image/MIME and file-size limits for each storage bucket.
- [ ] As EO, verify Event Log office/request filters paginate with an accurate total;
      verify another authenticated role receives an authorization error.

## 5. Edge Functions

Required functions:

- [ ] `admin-create-user` (JWT verification enabled)
- [ ] `send-notification-email` (JWT verification enabled)
- [ ] `verify-feedback-code` (public endpoint; application controls enforced)
- [ ] `submit-public-feedback` (public endpoint; application controls enforced)
- [ ] `process-notification-outbox` (scheduled worker secret required)

Deploy from the repository root only after local verification succeeds:

```bash
supabase functions deploy admin-create-user
supabase functions deploy send-notification-email
supabase functions deploy verify-feedback-code --no-verify-jwt
supabase functions deploy submit-public-feedback --no-verify-jwt
supabase functions deploy process-notification-outbox --no-verify-jwt
```

Configure a secret-bearing scheduler to `POST` to
`process-notification-outbox` with `x-outbox-secret`; never put that header value
in source control.

## 6. Remote deployment and post-deploy verification

Review the generated remote diff and target project before applying:

```bash
supabase db diff --linked
supabase migration list
supabase db push --dry-run
supabase db push
supabase migration list
```

- [ ] Confirm the four `20260909000*` migrations are applied remotely.
- [ ] Confirm all five functions show the expected deployed version.
- [ ] Confirm Auth redirect URLs include only approved local and production URLs.
- [ ] Exercise login, password reset, event workflow, reservation release,
      feedback, notification delivery, and retry behavior in staging.
- [ ] Inspect function/database logs for denied grants, RLS failures, rate-limit
      errors, outbox exhaustion, and storage policy failures.
- [ ] Promote the frontend only after staging checks pass.

These remote commands are intentionally documented but were **not run**.
