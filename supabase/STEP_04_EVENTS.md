# Step 4 — Event requests & workflow (Supabase)

Event requests now save to `public.event_requests` when Supabase is configured.

## Workflow (your spec)

**Student officer:** Adviser → Dean → OSAS → EO (schedule) → GSO (if needed) → EO (publish to calendar)

**SSC:** OSAS → EO (schedule) → GSO (if needed) → EO (publish)

**EO direct add:** Posted immediately (skips chain)

**Publish** (after all approvals, at `eo_publish`):

- **Student officer / SSC** — **Post to students** → `/student`  
- **Executive Officer** — **Post to calendar** → staff schedule only  

See `STEP_05_STUDENT.md` and migration `20260528700000_calendar_vs_student_post.sql`.

## Create form (Student Officer & SSC)

Both portals use the same fields:

- **Upload Word letter** (.doc / .docx) — stored in Supabase `event-letters` bucket
- **Organization** (dropdown from seeded orgs, or text if offline)
- **Activity**
- **Date range** + **start/end time**
- **Venue**
- **No. of participants**
- **SDG/s**
- Optional: **Needs GSO** checkbox

Run these in **Supabase → SQL Editor** (if submit fails with “row-level security”):

1. `migrations/20260528120000_event_letters_storage.sql` — letter uploads  
2. `migrations/20260528200000_fix_event_requests_rls.sql` — submit + letter update permissions

## Try it

1. Log in as **officer@eventlink.local** → Create Event Request.
2. Log in as **adviser@eventlink.local** → Approve on dashboard.
3. Continue: dean → osas → eo (approve) → gso (if GSO box checked) → eo **POST**.
4. Open **/student** (no login) — posted events should appear.

## Decline

Declining prompts for a reason and sets `status = declined`. Resubmit after decline is a follow-up (Step 4b).

## Venue conflict

Submit checks `check_venue_availability` RPC — same venue cannot overlap dates for pending/approved/posted events.

## Mock mode

If Supabase env vars are missing, portals still use local `initialData.ts` mock lists.

## Done when

You can submit one request as officer, approve through the chain, EO posts it, and it shows on `/student`.

**Next (Step 5):** Feedback rules, profile/org scoping, letter file upload.
