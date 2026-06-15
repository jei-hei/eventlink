# Step 1 — Dev auth (no confirmation email hassle)

Do this once while building EventLink locally. Say **“done”** when the checklist below passes.

## A. Turn off “Confirm email” in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your EventLink project.
2. Go to **Authentication** → **Providers** → **Email**.
3. **Disable** “Confirm email” (wording may be “Enable email confirmations” — turn it **off**).
4. Click **Save**.

## B. Site URL (if not done yet)

**Authentication** → **URL configuration**:

- **Site URL:** `http://localhost:5173`
- **Redirect URLs:** add `http://localhost:5173/**`

## C. Quick test (prove Step 1 is done)

Use a **new** test email you have not registered before (or delete the old user under **Authentication → Users**).

1. `npm run dev` in `app/`
2. `/signup` → valid registry ID (e.g. `23-0668`) → any email + password
3. You should land on `/student` **and** be able to open **`/student/profile`** without “email not confirmed”
4. Sign out → `/login` → same email/password → works immediately

## Backup (if you keep confirm email ON)

```bash
cd app
npm run confirm:user -- someone@example.com
```

## Before production / Vercel launch

Turn **Confirm email** back **on**, or configure **custom SMTP** under Authentication → SMTP, so real students verify their inbox.

---

**Step 1 complete when:** signup → profile works with no confirmation email and no `confirm:user` script needed.

Next step (when you say you’re done): **Step 2 — Admin student registry wired to Supabase.**
