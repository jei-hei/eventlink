/**
 * Create all test staff accounts from supabase/seed/staff_accounts.json
 *
 *   node --env-file=.env.seed scripts/seed-staff.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensurePortalUser } from "./lib/portal-user.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonPath = join(__dirname, "../../supabase/seed/staff_accounts.json");

const raw = readFileSync(jsonPath, "utf8");
const accounts = JSON.parse(raw);
const password = process.env.STAFF_SEED_PASSWORD;

if (!Array.isArray(accounts)) {
  console.error("staff_accounts.json must be an array");
  process.exit(1);
}
if (!password || password.length < 8) {
  throw new Error("Set STAFF_SEED_PASSWORD to a unique value of at least 8 characters.");
}

console.log(`Creating ${accounts.length} staff account(s)…\n`);

for (const row of accounts) {
  const result = await ensurePortalUser({
    role: row.role,
    email: row.email,
    password,
    displayName: row.displayName,
  });
  console.log(`✓ ${result.role.padEnd(16)} ${result.email} → ${result.home}`);
}

console.log("\nStaff seeding complete. Existing Auth accounts were not modified.");
console.log("Students still register via /signup (not in this file).");
