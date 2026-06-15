# EventLink — Web app (Vue 3)

Campus event workflow: student officers / SSC submit requests, staff approve in chain, Executive Officer publishes to the student feed.

## Prerequisites

- Node **20.19+** or **22.12+** (see `package.json` `engines`)
- A Supabase project with migrations applied (see [`../supabase/README.md`](../supabase/README.md))

## Setup

```bash
cd app
npm install
```

Create **`app/.env.local`** (or `.env`) from [`.env.example`](./.env.example):

- `VITE_SUPABASE_URL` — Project URL  
- `VITE_SUPABASE_ANON_KEY` — anon public key  

Without these, the app runs in **demo mode** (mock data, no live database).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (default `http://localhost:5173`) |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview production build |
| `npm run seed:admin` | Create admin user (needs `app/.env.seed` + service role — see `../supabase/README.md`) |
| `npm run create:user` | Create staff portal user (service role) |
| `npm run seed:staff` | Batch seed staff (optional) |

## Important migrations (if something breaks)

| Symptom | Migration / doc |
|---------|-------------------|
| Missing profile on login | `20260529300000_ensure_my_profile.sql` |
| Admin → Users list empty / RPC error | `20260529400000_admin_list_portal_users.sql` |
| Student feed / feedback errors | `STEP_05` / `202605289`–`202605291` in `../supabase/` |

## Tech stack

Vue 3, Vue Router, Pinia, Vite, Tailwind CSS v4, Supabase JS v2, TypeScript.
