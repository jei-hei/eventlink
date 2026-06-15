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

## Create admin login

From `app/` folder (uses `app/.env.seed` with **service_role** key):

```bash
npm run seed:admin
```

Default login unless you set `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env.seed`:

- Email: `admin@eventlink.local`
- Password: `EventLinkAdmin123!`

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
