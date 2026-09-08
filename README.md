
# EventLink — Capstone

| Folder | What |
|--------|------|
| **`app/`** | Vue 3 + Vite + TypeScript + Pinia + Tailwind + Supabase client |
| **`supabase/`** | SQL migrations, seeds, setup docs (`README.md`, `STEP_*.md`) |
| **`* design/`** | Reference UI (optional) |

## Quick start

1. **Database:** [`supabase/README.md`](./supabase/README.md) — migrations in order, seeds, Auth URL config.  
2. **Frontend:** [`app/README.md`](./app/README.md) — install, env vars, dev server.  
3. **Admin login:** From `app/` with service role in `.env.seed`, run `npm run seed:admin`.
4. **Adviser testing guide:** [`ADVISER_TEST_GUIDE.md`](./ADVISER_TEST_GUIDE.md) — end-to-end test checklist.

`supabase db push` does **not** deploy Edge Functions. After schema changes, also run:

```bash
supabase functions deploy admin-create-user
supabase functions deploy send-notification-email
```

Academic / capstone use per your institution’s policy.
