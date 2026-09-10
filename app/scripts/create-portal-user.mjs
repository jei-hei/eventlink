/**
 * Create one staff portal account with a fixed role.
 *
 *   PORTAL_USER_PASSWORD=<unique-password> node --env-file=.env.seed scripts/create-portal-user.mjs <role> <email> ["Display Name"]
 *
 * Existing Auth users keep their current credentials.
 */
import { ensurePortalUser, VALID_ROLES } from "./lib/portal-user.mjs";

const role = process.argv[2];
const email = process.argv[3];
const password = process.env.PORTAL_USER_PASSWORD;
const displayName = process.argv.slice(4).join(" ") || undefined;

if (!role || !email || !password || password.length < 8) {
  console.error(
    "Set PORTAL_USER_PASSWORD to a unique value of at least 8 characters, then run:\n" +
      "node --env-file=.env.seed scripts/create-portal-user.mjs <role> <email> [display name]\n\n" +
      `Roles: ${VALID_ROLES.join(", ")}`,
  );
  process.exit(1);
}

const result = await ensurePortalUser({ role, email, password, displayName });
console.log("\nPortal user ready.");
console.log("  Role:     ", result.role);
console.log("  Email:    ", result.email);
console.log("  Name:     ", result.displayName);
console.log("  Login →   ", result.home);
