import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const parserSource = await readFile(new URL("../src/services/officerImportParser.ts", import.meta.url), "utf8");
const fnSource = await readFile(
  new URL("../../supabase/functions/admin-bulk-provision/index.ts", import.meta.url),
  "utf8",
);
const migration = await readFile(
  new URL("../../supabase/migrations/20260922000100_protect_profile_assignment_fields.sql", import.meta.url),
  "utf8",
);
const usersView = await readFile(new URL("../src/views/admin/UsersView.vue", import.meta.url), "utf8");

function normalizeId(raw) {
  return String(raw).trim().toUpperCase();
}

function emailOk(email, requireIsu) {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes("@") || !trimmed.includes(".")) return false;
  if (requireIsu) return trimmed.endsWith("@isu.edu.ph");
  return true;
}

function validate(rows, catalog) {
  const students = new Map(catalog.students.map((s) => [normalizeId(s.studentId), s]));
  const portalByStudent = new Map(catalog.portalUsers.filter((u) => u.studentId).map((u) => [normalizeId(u.studentId), u]));
  const portalEmails = new Set(catalog.portalUsers.map((u) => u.email.toLowerCase()));
  const seenId = new Set();
  const seenEmail = new Set();
  return rows.map((row) => {
    const studentId = normalizeId(row.studentId);
    const email = row.email.trim().toLowerCase();
    const preview = { ...row, studentId, email, status: "Valid", message: "" };
    if (!studentId) {
      preview.status = "Invalid";
      preview.message = "Student ID is required.";
    } else if (!emailOk(email, catalog.requireIsuEmail)) {
      preview.status = "Invalid";
      preview.message = catalog.requireIsuEmail ? "Please use a valid ISU email address." : "bad email";
    } else if (seenId.has(studentId) || seenEmail.has(email)) {
      preview.status = "Invalid";
      preview.message = "Duplicate row";
    } else {
      seenId.add(studentId);
      seenEmail.add(email);
      const registry = students.get(studentId);
      if (registry?.archived) {
        preview.status = "Invalid";
        preview.message = `Student ID ${studentId} is archived in the registry.`;
      } else if (portalEmails.has(email)) {
        preview.status = "Duplicate";
        preview.message = "Email already belongs to an existing EventLink account.";
      } else if (portalByStudent.get(studentId)?.role === "student_officer") {
        preview.status = "Duplicate";
        preview.message = `Student ID ${studentId} is already assigned to a Student Officer.`;
      } else {
        const college = catalog.colleges.find((c) => c.name === row.college);
        if (!college) {
          preview.status = "Invalid";
          preview.message = `College "${row.college}" was not found.`;
        } else {
          const org = college.organizations.find((o) => o.name === row.organization);
          const other = catalog.colleges.some(
            (c) => c !== college && c.organizations.some((o) => o.name === row.organization),
          );
          if (!org && other) {
            preview.status = "Invalid";
            preview.message = `Organization "${row.organization}" does not belong to the selected college.`;
          } else if (!org) {
            preview.status = "Invalid";
            preview.message = `Organization "${row.organization}" was not found under "${college.name}".`;
          } else if (!registry) {
            preview.status = "Valid";
            preview.message = "Will create the Student Officer account and add this student to the registry.";
          } else {
            preview.status = "Valid";
          }
        }
      }
    }
    return preview;
  });
}

const catalog = {
  requireIsuEmail: true,
  colleges: [
    { name: "College of Computing Studies", organizations: [{ name: "ICT Society" }] },
    { name: "College of Business", organizations: [{ name: "JPIA" }] },
  ],
  students: [
    { studentId: "23-0668", fullName: "Ana Cruz", program: "BSIT", yearLevel: "3rd Year" },
    { studentId: "23-0669", fullName: "Ben Santos", program: "BSIT", yearLevel: "2nd Year" },
    { studentId: "23-0001", fullName: "Taken Officer", program: "BSIT", yearLevel: "3rd Year" },
  ],
  portalUsers: [{ email: "taken@isu.edu.ph", studentId: "23-0001", role: "student_officer" }],
};

const validRow = {
  studentId: "23-0668",
  fullName: "Ana Cruz",
  email: "ana@isu.edu.ph",
  college: "College of Computing Studies",
  organization: "ICT Society",
  program: "BSIT",
  yearLevel: "3rd Year",
  position: "President",
};

test("bulk provision is admin-only, forces allowed roles, and invites without spreadsheet passwords", () => {
  assert.match(fnSource, /roleRow\?\.role !== "admin"/);
  assert.match(fnSource, /inviteUserByEmail/);
  assert.match(fnSource, /portal_role: forcedRole/);
  assert.match(fnSource, /"adviser"/);
  assert.match(fnSource, /"dean"/);
  assert.match(fnSource, /require_isu_email/);
  assert.doesNotMatch(fnSource, /email_confirm:\s*true/);
  assert.match(fnSource, /deleteUser/);
  assert.match(parserSource, /student_id/);
  assert.match(parserSource, /position/);
  assert.doesNotMatch(parserSource, /employee_id/);
  assert.doesNotMatch(parserSource, /password/);
  assert.match(fnSource, /from\("students"\)\.insert/);
  assert.match(parserSource, /Will create the Student Officer account/);
  assert.match(migration, /protect_profile_assignment_fields/);
  assert.match(migration, /college_id is distinct from old.college_id/);
});

test("TEST 1 valid existing student + college + organization", () => {
  assert.equal(validate([validRow], catalog)[0].status, "Valid");
});

test("TEST 2 unknown college", () => {
  const rows = validate([{ ...validRow, college: "Unknown College" }], catalog);
  assert.equal(rows[0].status, "Invalid");
  assert.match(rows[0].message, /College "Unknown College" was not found/);
});

test("TEST 3 unknown organization", () => {
  const rows = validate([{ ...validRow, organization: "Missing Org" }], catalog);
  assert.equal(rows[0].status, "Invalid");
});

test("TEST 4 organization belongs to another college", () => {
  const rows = validate([{ ...validRow, organization: "JPIA" }], catalog);
  assert.equal(rows[0].status, "Invalid");
  assert.match(rows[0].message, /does not belong to the selected college/);
});

test("TEST 5 duplicate student ID already an officer", () => {
  const rows = validate([{ ...validRow, studentId: "23-0001", email: "new@isu.edu.ph" }], catalog);
  assert.equal(rows[0].status, "Duplicate");
});

test("TEST 6 existing Auth/portal email", () => {
  const rows = validate([{ ...validRow, email: "taken@isu.edu.ph" }], catalog);
  assert.equal(rows[0].status, "Duplicate");
});

test("TEST 7 invalid email while require_isu_email is ON", () => {
  const rows = validate([{ ...validRow, email: "ana@gmail.com" }], catalog);
  assert.equal(rows[0].status, "Invalid");
});

test("TEST 8 non-ISU email while require_isu_email is OFF", () => {
  const rows = validate([{ ...validRow, email: "ana@gmail.com" }], { ...catalog, requireIsuEmail: false });
  assert.equal(rows[0].status, "Valid");
});

test("TEST 9 duplicate spreadsheet rows", () => {
  const rows = validate([validRow, { ...validRow, email: "ana2@isu.edu.ph" }], catalog);
  assert.equal(rows[1].status, "Invalid");
});

test("TEST 10 missing required column is enforced in parser", () => {
  assert.match(
    parserSource,
    /student_id, full_name, email, college, program, year_level, organization, and position/,
  );
});

test("TEST 11 missing student ID", () => {
  const rows = validate([{ ...validRow, studentId: "" }], catalog);
  assert.equal(rows[0].status, "Invalid");
  assert.equal(rows[0].message, "Student ID is required.");
});

test("TEST 12 missing student ID is created as registry + officer account", () => {
  const rows = validate([{ ...validRow, studentId: "23-9999" }], catalog);
  assert.equal(rows[0].status, "Valid");
  assert.match(rows[0].message, /create the Student Officer account/);
});

test("TEST 13 non-admin is rejected by the bulk function", () => {
  assert.match(fnSource, /Only admin users can import portal accounts/);
});

test("TEST 14 Auth/profile failure deletes the new auth user", () => {
  assert.match(fnSource, /Profile could not be saved. The invitation was cancelled/);
  assert.match(fnSource, /await admin.auth.admin.deleteUser\(userId\)/);
});

test("TEST 15 multiple valid rows stay independently valid", () => {
  const rows = validate([validRow, { ...validRow, studentId: "23-0669", email: "ben@isu.edu.ph", fullName: "Ben Santos" }], catalog);
  assert.equal(rows[0].status, "Valid");
  assert.equal(rows[1].status, "Valid");
});
