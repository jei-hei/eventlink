/**
 * Create one staff portal account with a fixed role.
 *
 *   node --env-file=.env.seed scripts/create-portal-user.mjs <role> <email> <password> ["Display Name"]
 *
 * Example:
 *   node --env-file=.env.seed scripts/create-portal-user.mjs eo eo@eventlink.local EventLinkTest123! "Executive Officer"
 */
import { ensurePortalUser, VALID_ROLES } from "./lib/portal-user.mjs";

const role = process.argv[2];
const email = process.argv[3];
const password = process.argv[4];
const displayName = process.argv.slice(5).join(" ") || undefined;

if (!role || !email || !password) {
  console.error(
    "Usage: node --env-file=.env.seed scripts/create-portal-user.mjs <role> <email> <password> [display name]\n\n" +
      `Roles: ${VALID_ROLES.join(", ")}`,
  );
  process.exit(1);
}

const result = await ensurePortalUser({ role, email, password, displayName });
console.log("\nPortal user ready.");
console.log("  Role:     ", result.role);
console.log("  Email:    ", result.email);
console.log("  Password: ", result.password);
console.log("  Name:     ", result.displayName);
console.log("  Login →   ", result.home);
