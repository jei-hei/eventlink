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

if (!Array.isArray(accounts)) {
  console.error("staff_accounts.json must be an array");
  process.exit(1);
}

console.log(`Creating ${accounts.length} staff account(s)…\n`);

for (const row of accounts) {
  const result = await ensurePortalUser({
    role: row.role,
    email: row.email,
    password: row.password,
    displayName: row.displayName,
  });
  console.log(`✓ ${result.role.padEnd(16)} ${result.email} → ${result.home}`);
}

console.log("\nDefault password for all above: EventLinkTest123!");
console.log("Students still register via /signup (not in this file).");
