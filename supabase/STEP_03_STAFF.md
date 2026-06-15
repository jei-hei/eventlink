# Step 3 — Staff portal accounts

One login per office role (your rule). Students still use **/signup** + registry.

## Create all test staff (recommended)

From `app/`:

```bash
npm run seed:staff
```

This reads `supabase/seed/staff_accounts.json` and creates:

| Role | Email | Portal after login |
|------|--------|-------------------|
| student_officer | officer@eventlink.local | /student-officer |
| ssc | ssc@eventlink.local | /ssc |
| adviser | adviser@eventlink.local | /adviser |
| dean | dean@eventlink.local | /dean |
| osas | osas@eventlink.local | /osas |
| eo | eo@eventlink.local | /executive-officer |
| gso | gso@eventlink.local | /gso |

**Password (all):** `EventLinkTest123!`

Admin was created earlier with `npm run seed:admin`.

## Admin → Users page

After seeding staff, open **Admin → Users** to see everyone with a portal role. If the table fails to load, run migration `migrations/20260529400000_admin_list_portal_users.sql` in the Supabase SQL Editor (adds the `admin_list_portal_users` RPC).

## Create one account manually

```bash
node --env-file=.env.seed scripts/create-portal-user.mjs eo eo@eventlink.local EventLinkTest123! "Executive Officer"
```

Roles: `student_officer`, `ssc`, `adviser`, `dean`, `osas`, `eo`, `gso`, `admin`

## Verify Step 3

1. Sign out completely (or use incognito).
2. `/login` as `eo@eventlink.local` / `EventLinkTest123!` → should land on **Executive Officer** portal.
3. Repeat for adviser, dean, gso, etc.
4. Wrong role should redirect to that user’s home (router guard).

## Done when

You can log in as each office and open its portal without using admin or student accounts.

**Next (Step 4):** Event requests + approval workflow in Supabase.
