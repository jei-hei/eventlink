# EventLink — Supabase

## Build steps (in order)

| Step | Doc | What |
|------|-----|------|
| **1** | [STEP_01_DEV_AUTH.md](./STEP_01_DEV_AUTH.md) | Turn off confirm email for local dev |
| **2** | [STEP_02_REGISTRY.md](./STEP_02_REGISTRY.md) | Admin student registry → Supabase |
| **3** | [STEP_03_STAFF.md](./STEP_03_STAFF.md) | Staff portal test accounts |
| **4** | [STEP_04_EVENTS.md](./STEP_04_EVENTS.md) | Event requests + workflow |
| **5** | [STEP_05_STUDENT.md](./STEP_05_STUDENT.md) (if present) | Student feed + posted events |
| **6** | `migrations/20260529100000_feedback_feed_posts.sql` + later timestamps | Feedback, profiles, admin user list RPC |

## Apply schema

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**.
2. Run `migrations/20260527120000_eventlink_initial.sql` (paste full file → Run).

Or use Supabase CLI: `supabase db push` from repo root if linked.

## Seed students

In SQL Editor, run (in order):

1. `seed/01_students.sql` — registry rows including `23-0668`
2. `seed/02_equipment.sql` — optional GSO catalog

Students can then **Sign up** at `/signup` with that exact ID and any email.

## Deploy database vs Edge Functions

`supabase db push` applies SQL migrations only. It does **not** deploy Edge Functions.

| What | Command (from repo root, project linked) |
|------|------------------------------------------|
| Database migrations | `supabase db push` |
| Admin create-user function | `supabase functions deploy admin-create-user` |
| Notification email function | `supabase functions deploy send-notification-email` |
| Feedback code verification | `supabase functions deploy verify-feedback-code --no-verify-jwt` |
| Public feedback submission | `supabase functions deploy submit-public-feedback --no-verify-jwt` |
| Notification outbox retry worker | `supabase functions deploy process-notification-outbox --no-verify-jwt` |

Public feedback remains available to the anon browser client. Its two functions disable
gateway JWT verification intentionally and enforce exact allowed origins, fixed server-side
rate limits, bounded payloads, and service-role-only database RPCs internally.

`send-notification-email` keeps gateway JWT verification enabled and also validates the
initiating user before claiming that user's stored outbox notification. The retry worker
does not accept browser requests and requires `x-outbox-secret`; schedule an authenticated
HTTP `POST` to it (for example, every minute using a scheduler that can store secret headers).
Retries use exponential backoff, recover stale claims, stop after five attempts, and use a
stable Resend idempotency key per notification.

Required functions in `supabase/functions/`:

- `admin-create-user`
- `send-notification-email`
- `verify-feedback-code`
- `submit-public-feedback`
- `process-notification-outbox`

## Edge Function secrets

Set secrets before deploying the feedback and notification functions:

```bash
supabase secrets set \
  ALLOWED_ORIGINS="https://your-production-app.example,http://localhost:5173" \
  RATE_LIMIT_SALT="<long-random-secret>" \
  RESEND_API_KEY="<resend-api-key>" \
  NOTIFICATION_FROM_EMAIL="EventLink <notifications@your-verified-domain.example>" \
  OUTBOX_WORKER_SECRET="<independent-long-random-secret>"
```

- `ALLOWED_ORIGINS` is a comma-separated list of exact origins, without paths or wildcard
  entries. Include local development explicitly only where needed.
- `RATE_LIMIT_SALT` must be random and private; it hashes client network identifiers before
  database rate-limit keys are stored.
- `RESEND_API_KEY` and `NOTIFICATION_FROM_EMAIL` must belong to a verified Resend sender.
- `OUTBOX_WORKER_SECRET` is only for the scheduled retry request and must not be exposed to
  the browser or committed to source control.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are supplied by the
  Supabase runtime. Never expose the service-role key to the app.

This repository does not use `supabase/config.toml`, so function JWT behavior is expressed
in the deploy commands above rather than adding a partial local configuration file.

## Notification enqueue integration

Workflow callers must use:

```text
enqueue_notification(
  p_user_id uuid,
  p_event_type text,
  p_request_id uuid,
  p_dedup_key text,
  p_context jsonb
)
```

Supported request event types are `request_submitted`, `request_approved`,
`sent_to_resource_offices`, `resource_review_required`, `event_scheduled`,
`resource_declined`, `request_declined`, `published_student_feed`,
`published_staff_calendar`, `event_cancelled`, `revision_requested`,
`schedule_updated`, and `request_resubmitted`. `login_detected` is self-only and does not
accept a request id. The database selects the title, body, category, event data, and any
workflow detail from stored request/history rows. A transitional `p_context.detail` key is
accepted but ignored; callers cannot inject cross-user message content. Use a stable
action/history identifier as `p_dedup_key`.

`app/src/services/notificationsDb.ts` exposes the matching `enqueueNotification` wrapper.
When `eventRequestsDb.ts` is refactored by its owner, replace direct notification inserts
and arbitrary email calls with this wrapper, passing the event request id and event type.

## Create admin login

From `app/` folder (uses `app/.env.seed` with **service_role** key):

```bash
npm run seed:admin
```

Set `ADMIN_PASSWORD` in `.env.seed` to a unique value before creating a new admin. The
script never changes credentials for an Auth account that already exists.

Then open `http://localhost:5173/login`.

Manual alternative: create user in **Authentication → Users**, then:

```sql
insert into public.user_roles (user_id, role)
values ('<auth-user-uuid>', 'admin')
on conflict (user_id) do update set role = excluded.role;
```

## Email confirmation (important for student signup)

If students see **“Email not confirmed”** on login, Supabase is waiting for them to click the link in their inbox.

**For local development (recommended):** Supabase Dashboard → **Authentication** → **Providers** → **Email** → turn **off** “Confirm email”. Students can sign in immediately after signup.

**For production:** keep confirmation on; the app shows a “Confirm your email” screen after signup and offers **Resend confirmation email** on login.

To fix an account you already created: **Authentication → Users** → select the user → **Confirm user** (or delete and register again after turning confirm off).

## After migration

1. **Authentication → URL configuration**: add `http://localhost:5173/**` and your Vercel URL `https://*.vercel.app/**`.
2. Put **Project URL** + **anon** key in `app/.env.local` (or `app/.env`) as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Run student seed SQL (above).
4. Run `npm run seed:admin` or create staff users manually:

```sql
insert into public.user_roles (user_id, role)
values ('<auth-user-uuid>', 'admin')
on conflict (user_id) do update set role = excluded.role;
```

## Storage

Migration creates private bucket `event-letters` for Word attachments. Add storage policies in Dashboard when wiring uploads.
