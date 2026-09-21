import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const parserSource = await readFile(new URL("../src/services/staffImportParser.ts", import.meta.url), "utf8");
const fnSource = await readFile(
  new URL("../../supabase/functions/admin-bulk-provision/index.ts", import.meta.url),
  "utf8",
);
const usersView = await readFile(new URL("../src/views/admin/UsersView.vue", import.meta.url), "utf8");

function validate(rows, catalog, kind) {
  const portalEmails = new Set(catalog.portalUsers.map((u) => u.email.toLowerCase()));
  const deanByCollege = new Map(
    catalog.portalUsers.filter((u) => u.role === "dean").map((u) => [u.college.toLowerCase(), u]),
  );
  const adviserByOrg = new Map(catalog.orgAssignments.filter((a) => a.role === "adviser").map((a) => [a.organizationId, a]));
  const seenEmail = new Set();
  return rows.map((row) => {
    const email = row.email.toLowerCase();
    const preview = { ...row, status: "Valid", message: "" };
    if (!row.fullName) preview.status = "Invalid";
    else if (catalog.requireIsuEmail && !email.endsWith("@isu.edu.ph")) preview.status = "Invalid";
    else if (seenEmail.has(email) || portalEmails.has(email)) {
      preview.status = "Duplicate";
      preview.message = "Email already belongs to an existing EventLink account.";
    } else {
      seenEmail.add(email);
      const college = catalog.colleges.find((c) => c.name === row.college);
      if (!college) {
        preview.status = "Invalid";
        preview.message = `College "${row.college}" was not found.`;
      } else if (kind === "dean") {
        if (deanByCollege.has(college.name.toLowerCase())) {
          preview.status = "Duplicate";
          preview.message = `College "${college.name}" already has a registered Dean.`;
        }
      } else {
        const org = college.organizations.find((o) => o.name === row.organization);
        const other = catalog.colleges.some(
          (c) => c !== college && c.organizations.some((o) => o.name === row.organization),
        );
        if (!org && other) {
          preview.status = "Invalid";
          preview.message = `Organization "${row.organization}" does not belong to the selected college.`;
        } else if (!org) preview.status = "Invalid";
        else if (adviserByOrg.has(org.id)) {
          preview.status = "Duplicate";
          preview.message = `Organization "${org.name}" already has a registered Adviser.`;
        }
      }
    }
    return preview;
  });
}

const catalog = {
  requireIsuEmail: true,
  colleges: [
    { id: "c1", name: "College of Computing Studies", organizations: [{ id: "o1", name: "ICT Society" }] },
    { id: "c2", name: "College of Business", organizations: [{ id: "o2", name: "JPIA" }] },
  ],
  portalUsers: [
    { email: "taken@isu.edu.ph", role: "adviser", college: "College of Computing Studies" },
    { email: "dean@isu.edu.ph", role: "dean", college: "College of Business" },
  ],
  orgAssignments: [{ organizationId: "o1", role: "adviser", displayName: "Existing Adviser" }],
};

const adviserRow = {
  fullName: "Ada Adviser",
  email: "ada@isu.edu.ph",
  college: "College of Computing Studies",
  organization: "ICT Society",
  position: "Program Adviser",
};

const deanRow = {
  fullName: "Dana Dean",
  email: "dana@isu.edu.ph",
  college: "College of Computing Studies",
  organization: "",
  position: "Dean",
};

test("staff import reuses bulk provision, forces adviser/dean, and has no password column", () => {
  assert.match(fnSource, /ALLOWED_ROLES/);
  assert.match(fnSource, /"adviser"/);
  assert.match(fnSource, /"dean"/);
  assert.match(fnSource, /portal_role: forcedRole/);
  assert.match(fnSource, /inviteUserByEmail/);
  assert.doesNotMatch(fnSource, /email_confirm:\s*true/);
  assert.match(parserSource, /full_name, email, college, organization, and position/);
  assert.match(parserSource, /full_name, email, college, and position/);
  assert.match(parserSource, /Do not include a password column/);
  assert.match(usersView, /kind="adviser"/);
  assert.match(usersView, /kind="dean"/);
});

test("adviser valid college + organization", () => {
  const rows = validate([adviserRow], { ...catalog, orgAssignments: [], portalUsers: [] }, "adviser");
  assert.equal(rows[0].status, "Valid");
});

test("adviser organization belongs to another college", () => {
  const rows = validate([{ ...adviserRow, organization: "JPIA" }], { ...catalog, orgAssignments: [], portalUsers: [] }, "adviser");
  assert.equal(rows[0].status, "Invalid");
  assert.match(rows[0].message, /does not belong to the selected college/);
});

test("adviser duplicate organization", () => {
  const rows = validate([adviserRow], catalog, "adviser");
  assert.equal(rows[0].status, "Duplicate");
});

test("dean valid college", () => {
  const rows = validate([deanRow], { ...catalog, portalUsers: [] }, "dean");
  assert.equal(rows[0].status, "Valid");
});

test("dean college already assigned", () => {
  const rows = validate([{ ...deanRow, college: "College of Business", email: "newdean@isu.edu.ph" }], catalog, "dean");
  assert.equal(rows[0].status, "Duplicate");
});

test("dean unknown college", () => {
  const rows = validate([{ ...deanRow, college: "Missing College" }], catalog, "dean");
  assert.equal(rows[0].status, "Invalid");
});

test("staff email policy", () => {
  const on = validate([{ ...deanRow, email: "dana@gmail.com" }], { ...catalog, portalUsers: [] }, "dean");
  assert.equal(on[0].status, "Invalid");
  const off = validate(
    [{ ...deanRow, email: "dana@gmail.com" }],
    { ...catalog, requireIsuEmail: false, portalUsers: [] },
    "dean",
  );
  assert.equal(off[0].status, "Valid");
});

test("existing auth email is duplicate", () => {
  const rows = validate([{ ...deanRow, email: "taken@isu.edu.ph" }], catalog, "dean");
  assert.equal(rows[0].status, "Duplicate");
});
