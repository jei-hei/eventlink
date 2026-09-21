import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const parserSource = await readFile(
  new URL("../src/services/collegeOrgImportParser.ts", import.meta.url),
  "utf8",
);
const rpcSource = await readFile(
  new URL("../../supabase/migrations/20260921000200_admin_import_colleges_organizations.sql", import.meta.url),
  "utf8",
);
const collegesView = await readFile(new URL("../src/views/admin/CollegesView.vue", import.meta.url), "utf8");

function normalizeOrganizationCode(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isExampleRow(row) {
  const college = row.collegeName.trim().toLowerCase();
  const org = row.organizationName.trim().toLowerCase();
  const code = normalizeOrganizationCode(row.organizationCode);
  return college.startsWith("example ") || org.startsWith("example ") || code.startsWith("example-");
}

function validate(rows, catalog) {
  const collegesByName = new Map();
  for (const college of catalog) {
    const key = college.name.trim().toLowerCase();
    const list = collegesByName.get(key) ?? [];
    list.push(college);
    collegesByName.set(key, list);
  }
  const seenName = new Set();
  const seenSlug = new Set();
  const out = [];
  for (const row of rows) {
    if (isExampleRow(row)) continue;
    const collegeName = row.collegeName.trim();
    const organizationName = row.organizationName.trim();
    const organizationCode = normalizeOrganizationCode(row.organizationCode);
    const preview = {
      collegeName,
      organizationName,
      organizationCode,
      status: "Valid",
      message: "",
    };
    if (!collegeName) {
      preview.status = "Invalid";
      preview.message = "College name is required.";
    } else if (!organizationName) {
      preview.status = "Invalid";
      preview.message = "Organization name is required.";
    } else if (!organizationCode) {
      preview.status = "Invalid";
      preview.message = "Organization code is required.";
    } else if (organizationCode === "ssc") {
      preview.status = "Invalid";
      preview.message = "reserved";
    } else {
      const nameKey = `${collegeName.toLowerCase()}\u001f${organizationName.toLowerCase()}`;
      const slugKey = `${collegeName.toLowerCase()}\u001f${organizationCode}`;
      if (seenName.has(nameKey) || seenSlug.has(slugKey)) {
        preview.status = "Invalid";
        preview.message = "Duplicate row";
      } else {
        seenName.add(nameKey);
        seenSlug.add(slugKey);
        const matches = collegesByName.get(collegeName.toLowerCase()) ?? [];
        if (matches.length === 1) {
          const college = matches[0];
          const existingByName = college.organizations.find(
            (org) => org.name.trim().toLowerCase() === organizationName.toLowerCase(),
          );
          const existingBySlug = college.organizations.find(
            (org) => (org.slug ?? "").trim().toLowerCase() === organizationCode,
          );
          if (existingByName) {
            preview.status = "Duplicate";
            preview.message = `Organization "${organizationName}" already exists under "${collegeName}".`;
          } else if (existingBySlug) {
            preview.status = "Invalid";
            preview.message = "code used";
          } else {
            preview.status = "Valid";
          }
        } else if (matches.length === 0) {
          preview.status = "Warning";
        } else {
          preview.status = "Invalid";
        }
      }
    }
    out.push(preview);
  }
  return out;
}

const ccs = {
  name: "College of Computing Studies",
  organizations: [{ name: "ICT Society", slug: "ccs-ict" }],
};

test("college/org import RPC stays admin-only, transactional, and uses existing tables", () => {
  assert.match(rpcSource, /create or replace function public\.admin_import_colleges_organizations/);
  assert.match(rpcSource, /has_role\(auth\.uid\(\), 'admin'\)/);
  assert.match(rpcSource, /insert into public\.colleges/);
  assert.match(rpcSource, /insert into public\.organizations \(college_id, name, slug\)/);
  assert.match(rpcSource, /No changes were applied/);
  assert.match(rpcSource, /grant execute[\s\S]*to authenticated;/);
  assert.match(rpcSource, /revoke all[\s\S]*from public, anon;/);
  assert.doesNotMatch(rpcSource, /create table public\.(colleges|organizations)/);
});

test("parser maps organization_code to slug rules and skips example template rows", () => {
  assert.match(parserSource, /organization_code/);
  assert.match(parserSource, /example-/);
  assert.match(parserSource, /organizations\.slug|organizationCode === "ssc"/);
  assert.match(collegesView, /Download Template/);
  assert.match(collegesView, /Confirm import/);
  assert.doesNotMatch(collegesView, /employee_id/);
});

test("TEST 1 new college + new organization is Warning", () => {
  const rows = validate(
    [{ collegeName: "College of Nursing", organizationName: "Nursing Society", organizationCode: "con-ns" }],
    [ccs],
  );
  assert.equal(rows[0].status, "Warning");
});

test("TEST 2 existing college + new organization is Valid", () => {
  const rows = validate(
    [{ collegeName: "College of Computing Studies", organizationName: "Math Club", organizationCode: "ccs-math" }],
    [ccs],
  );
  assert.equal(rows[0].status, "Valid");
});

test("TEST 3 existing college + existing organization is Duplicate", () => {
  const rows = validate(
    [{ collegeName: "College of Computing Studies", organizationName: "ICT Society", organizationCode: "ccs-ict" }],
    [ccs],
  );
  assert.equal(rows[0].status, "Duplicate");
  assert.match(rows[0].message, /already exists under "College of Computing Studies"/);
});

test("TEST 4 same organization name under two colleges is allowed", () => {
  const rows = validate(
    [
      { collegeName: "College of Computing Studies", organizationName: "Honor Society", organizationCode: "ccs-hs" },
      { collegeName: "College of Business", organizationName: "Honor Society", organizationCode: "cbm-hs" },
    ],
    [ccs],
  );
  assert.equal(rows[0].status, "Valid");
  assert.equal(rows[1].status, "Warning");
});

test("TEST 5 duplicate rows inside spreadsheet are Invalid", () => {
  const rows = validate(
    [
      { collegeName: "College of Computing Studies", organizationName: "Math Club", organizationCode: "ccs-math" },
      { collegeName: "College of Computing Studies", organizationName: "Math Club", organizationCode: "ccs-math-2" },
    ],
    [ccs],
  );
  assert.equal(rows[1].status, "Invalid");
});

test("TEST 6 missing college is Invalid", () => {
  const rows = validate(
    [{ collegeName: "", organizationName: "ICT Society", organizationCode: "ccs-ict" }],
    [ccs],
  );
  assert.equal(rows[0].status, "Invalid");
  assert.equal(rows[0].message, "College name is required.");
});

test("TEST 7 missing organization is Invalid", () => {
  const rows = validate(
    [{ collegeName: "College of Computing Studies", organizationName: "", organizationCode: "ccs-ict" }],
    [ccs],
  );
  assert.equal(rows[0].status, "Invalid");
  assert.equal(rows[0].message, "Organization name is required.");
});

test("TEST 8 duplicate organization code under the same college is Invalid", () => {
  const rows = validate(
    [{ collegeName: "College of Computing Studies", organizationName: "Other Club", organizationCode: "ccs-ict" }],
    [ccs],
  );
  assert.equal(rows[0].status, "Invalid");
});
