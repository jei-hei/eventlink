# Step 2 — Admin student registry → Supabase

## What changed

- **Admin → Students** loads and saves to `public.students`.
- CSV/XLSX **Merge preview** upserts into Supabase.
- Edit / archive persist to the database.
- **Signup** still uses `verify_student_registry` (same table).

## How to verify

1. Log in as **admin**.
2. Open **Students** — list should match SQL seed (e.g. `23-0668` J-A Miguel).
3. Edit a row → refresh page → change remains.
4. Sign out → **Sign up** as a student with that ID → should validate.

## Done when

Registry in admin and signup use the **same** Supabase data.

Next: **Step 3** — staff role accounts (adviser, dean, EO, etc.).
