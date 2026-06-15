/**
 * Creates (or updates) an EventLink admin auth user + public.user_roles row.
 *
 * Usage (from app/ folder):
 *   node --env-file=.env.seed scripts/create-admin.mjs
 *
 * Or with .env.local if you add service role there:
 *   node --env-file=.env.local scripts/create-admin.mjs
 *
 * Required in env file:
 *   VITE_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   ADMIN_EMAIL (default admin@eventlink.local)
 *   ADMIN_PASSWORD (default EventLinkAdmin123!)
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.ADMIN_EMAIL ?? "admin@eventlink.local").trim();
const password = process.env.ADMIN_PASSWORD ?? "EventLinkAdmin123!";

if (!url || !serviceKey) {
  console.error(
    "Missing SUPABASE URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Add them to app/.env.seed or app/.env.local and run:\n" +
      "  node --env-file=.env.seed scripts/create-admin.mjs",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(targetEmail) {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase()) ?? null;
}

async function main() {
  let user = await findUserByEmail(email);

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "Admin User" },
    });
    if (error) throw error;
    user = data.user;
    console.log("Created auth user:", user.id);
  } else {
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
    console.log("Auth user already exists; password updated:", user.id);
  }

  const { error: roleErr } = await supabase.from("user_roles").upsert(
    { user_id: user.id, role: "admin" },
    { onConflict: "user_id" },
  );
  if (roleErr) throw roleErr;

  const { error: profileErr } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      display_name: "Admin User",
      email,
    },
    { onConflict: "id" },
  );
  if (profileErr) throw profileErr;

  console.log("\nAdmin ready.");
  console.log("  Email:   ", email);
  console.log("  Password:", password);
  console.log("  Login:   http://localhost:5173/login → redirects to /admin");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
