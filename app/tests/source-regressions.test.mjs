import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const roleSource = await readFile(new URL("../src/types/appRole.ts", import.meta.url), "utf8");
const routerSource = await readFile(new URL("../src/router/index.ts", import.meta.url), "utf8");
const guardSource = await readFile(new URL("../src/router/guards.ts", import.meta.url), "utf8");
const eventsLogSource = await readFile(new URL("../src/services/eventsLogDb.ts", import.meta.url), "utf8");
const eventRequestsSource = await readFile(
  new URL("../src/services/eventRequestsDb.ts", import.meta.url),
  "utf8",
);
const queryProjectionMigration = await readFile(
  new URL("../../supabase/migrations/20260909000400_query_projections.sql", import.meta.url),
  "utf8",
);

const roleRoutes = new Map([
  ["student_officer", "/student-officer"],
  ["ssc", "/ssc"],
  ["adviser", "/adviser"],
  ["dean", "/dean"],
  ["osas", "/osas"],
  ["eo", "/executive-officer"],
  ["gso", "/gso"],
  ["it_infrastructure", "/it-infrastructure"],
  ["sports_office", "/sports-office"],
  ["infirmary", "/infirmary"],
  ["nstp", "/nstp"],
  ["admin", "/admin"],
]);

function quotedValues(source) {
  return [...source.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

test("active role literals remain an exact 12-role contract", () => {
  const appRolesBlock = roleSource.match(
    /export const APP_ROLES: AppRole\[\] = \[([\s\S]*?)\];/,
  );

  assert.ok(appRolesBlock, "APP_ROLES declaration was not found");
  assert.deepEqual(quotedValues(appRolesBlock[1]), [...roleRoutes.keys()]);
  assert.match(roleSource, /export const LEGACY_STUDENT_ROLE = "student" as const;/);
  assert.doesNotMatch(appRolesBlock[1], /"student"/);
});

test("every active role has one guarded top-level portal route", () => {
  for (const [role, route] of roleRoutes) {
    const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedRole = role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const routeGuard = new RegExp(
      `path:\\s*"${escapedRoute}"[\\s\\S]{0,120}?allowedRoles:\\s*\\["${escapedRole}"\\]`,
    );

    assert.match(routerSource, routeGuard, `${role} must guard ${route}`);
  }
});

test("every role home stays inside its own guarded portal", () => {
  const homeBlock = roleSource.match(
    /export const ROLE_HOME_PATH: Record<AppRole, string> = \{([\s\S]*?)\};/,
  );

  assert.ok(homeBlock, "ROLE_HOME_PATH declaration was not found");

  for (const [role, route] of roleRoutes) {
    const key = role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = homeBlock[1].match(new RegExp(`\\b${key}:\\s*"([^"]+)"`));

    assert.ok(match, `${role} must have a home route`);
    assert.ok(
      match[1] === route || match[1].startsWith(`${route}/`),
      `${role} home ${match[1]} must remain under ${route}`,
    );
  }
});

test("route guards fail closed for unauthenticated and wrong-role users", () => {
  assert.match(
    guardSource,
    /if \(!auth\.isAuthenticated\)\s*\{\s*return \{ name: "login", query: \{ redirect: to\.fullPath \} \};/,
  );
  assert.match(
    guardSource,
    /if \(allowed\?\.length && auth\.appRole && !allowed\.includes\(auth\.appRole\)\)/,
  );
  assert.match(guardSource, /return auth\.homePath;/);
});

test("only explicit authentication and public-event routes bypass portal guards", () => {
  const publicNames = guardSource.match(/const PUBLIC_NAMES = new Set\(\[([^\]]+)\]\);/);

  assert.ok(publicNames, "PUBLIC_NAMES declaration was not found");
  assert.deepEqual(quotedValues(publicNames[1]), [
    "login",
    "forgot-password",
    "reset-password",
    "public-events",
  ]);
  assert.match(roleSource, /export const PUBLIC_EVENTS_PATH = "\/events";/);
});

test("EO Event Log uses the restricted server-side projection", () => {
  assert.match(eventsLogSource, /\.rpc\("eo_event_log_page"/);
  assert.match(queryProjectionMigration, /security definer/i);
  assert.match(queryProjectionMigration, /set search_path = pg_catalog, public/i);
  assert.match(queryProjectionMigration, /not public\.has_role\(auth\.uid\(\), 'eo'/i);
  assert.match(queryProjectionMigration, /grant execute[\s\S]*to authenticated;/i);
  assert.match(queryProjectionMigration, /p_office/i);
  assert.match(queryProjectionMigration, /count\(\*\) from filtered/i);
});

test("calendar ranges page to completion with an explicit safety failure", () => {
  assert.match(eventRequestsSource, /const hardSafetyLimit = 5_000;/);
  assert.match(eventRequestsSource, /\.range\(from, from \+ pageSize - 1\)/);
  assert.match(eventRequestsSource, /\.order\("id", \{ ascending: true \}\)/);
  assert.match(eventRequestsSource, /Calendar range exceeds/);
  assert.doesNotMatch(eventRequestsSource, /params\.limit/);
});
