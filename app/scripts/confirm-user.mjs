/**
 * Manually confirm a user's email (skip inbox link) — development only.
 *
 *   node --env-file=.env.seed scripts/confirm-user.mjs mja0935@gmail.com
 */
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.trim();
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email) {
  console.error("Usage: node --env-file=.env.seed scripts/confirm-user.mjs <email>");
  process.exit(1);
}

if (!url || !serviceKey) {
  console.error("Missing SUPABASE URL or SUPABASE_SERVICE_ROLE_KEY in .env.seed");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (error) {
  console.error(error);
  process.exit(1);
}

const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No auth user found for: ${email}`);
  process.exit(1);
}

const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
  email_confirm: true,
});

if (updateErr) {
  console.error(updateErr);
  process.exit(1);
}

console.log("Email confirmed for:", email);
console.log("User id:", user.id);
console.log("They can sign in at http://localhost:5173/login");
