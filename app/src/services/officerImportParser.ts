import { downloadCsv } from "@/utils/downloadCsv";
import { emailMeetsAdminPolicy, ISU_EMAIL_ERROR, EMAIL_FORMAT_ERROR } from "@/utils/isuEmail";
import { isValidStudentIdFormat, normalizeStudentId } from "@/types/studentRegistry";

export const OFFICER_IMPORT_MAX_BYTES = 1_000_000;
export const OFFICER_IMPORT_MAX_ROWS = 100;

export type OfficerImportStatus = "Valid" | "Invalid" | "Duplicate" | "Warning";

export type OfficerImportRow = {
  row: number;
  studentId: string;
  fullName: string;
  email: string;
  college: string;
  program: string;
  yearLevel: string;
  organization: string;
  position: string;
};

export type OfficerImportPreviewRow = OfficerImportRow & {
  status: OfficerImportStatus;
  message: string;
};

export type OfficerImportCatalog = {
  requireIsuEmail: boolean;
  colleges: Array<{
    name: string;
    code: string | null;
    organizations: Array<{ name: string; slug: string | null }>;
  }>;
  students: Array<{
    studentId: string;
    fullName: string;
    course: string;
    program: string;
    yearLevel: string;
    archived?: boolean;
  }>;
  portalUsers: Array<{ email: string; studentId: string; role: string }>;
};

type HeaderField =
  | "student_id"
  | "full_name"
  | "email"
  | "college"
  | "program"
  | "year_level"
  | "organization"
  | "position";

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQ = !inQ;
      continue;
    }
    if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

function headerKey(h: string): HeaderField | null {
  const x = normalizeHeader(h);
  if (["student_id", "studentid", "id"].includes(x)) return "student_id";
  if (["full_name", "fullname", "name"].includes(x)) return "full_name";
  if (["email", "e_mail", "e-mail"].includes(x)) return "email";
  if (["college", "college_name"].includes(x)) return "college";
  if (["program", "course_program"].includes(x)) return "program";
  if (["year_level", "yearlevel", "year"].includes(x)) return "year_level";
  if (["organization", "organization_name", "org"].includes(x)) return "organization";
  if (["position", "officer_position"].includes(x)) return "position";
  return null;
}

function normalizeOrgKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function isOfficerExampleRow(row: OfficerImportRow): boolean {
  return (
    row.fullName.trim().toLowerCase().startsWith("example ") ||
    row.email.trim().toLowerCase().startsWith("example.") ||
    row.college.trim().toLowerCase().startsWith("example ")
  );
}

function rowFromCells(cells: string[], headerMap: { index: number; key: HeaderField }[], rowIndex: number): OfficerImportRow | null {
  const obj: Partial<Record<HeaderField, string>> = {};
  for (const { index, key } of headerMap) obj[key] = cells[index] ?? "";
  const studentId = normalizeStudentId(obj.student_id ?? "");
  const fullName = (obj.full_name ?? "").trim();
  const email = (obj.email ?? "").trim();
  const college = (obj.college ?? "").trim();
  const program = (obj.program ?? "").trim();
  const yearLevel = (obj.year_level ?? "").trim();
  const organization = (obj.organization ?? "").trim();
  const position = (obj.position ?? "").trim();
  if (!studentId && !fullName && !email && !college && !organization) return null;
  return { row: rowIndex, studentId, fullName, email, college, program, yearLevel, organization, position };
}

function parseGrid(rows: string[][]): OfficerImportRow[] {
  if (rows.length < 2) throw new Error("The file has no data rows.");
  const headerMap: { index: number; key: HeaderField }[] = [];
  rows[0]!.forEach((value, index) => {
    const key = headerKey(String(value ?? ""));
    if (key && !headerMap.some((h) => h.key === key)) headerMap.push({ index, key });
  });
  const keys = new Set(headerMap.map((h) => h.key));
  const required: HeaderField[] = [
    "student_id",
    "full_name",
    "email",
    "college",
    "program",
    "year_level",
    "organization",
    "position",
  ];
  if (required.some((key) => !keys.has(key))) {
    throw new Error(
      "The file must include student_id, full_name, email, college, program, year_level, organization, and position.",
    );
  }
  const parsed: OfficerImportRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rowFromCells(rows[i] ?? [], headerMap, i + 1);
    if (row) parsed.push(row);
  }
  return parsed;
}

export function parseOfficerCsv(text: string): OfficerImportRow[] {
  return parseGrid(
    text
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0)
      .map((line) => splitCsvLine(line)),
  );
}

export async function parseOfficerXlsx(buffer: ArrayBuffer): Promise<OfficerImportRow[]> {
  const { readSheet } = await import("read-excel-file/browser");
  const sheetRows = await readSheet(buffer);
  return parseGrid(sheetRows.map((row) => row.map((value) => String(value ?? "").trim())));
}

export function downloadOfficerTemplate(): void {
  downloadCsv("eventlink-student-officer-template.csv", [
    ["student_id", "full_name", "email", "college", "program", "year_level", "organization", "position"],
    [
      "00-0000",
      "EXAMPLE Officer",
      "example.officer@isu.edu.ph",
      "EXAMPLE College of Computing Studies",
      "BSIT",
      "3rd Year",
      "EXAMPLE ICT Society",
      "President",
    ],
  ]);
}

export function validateOfficerImportRows(rows: OfficerImportRow[], catalog: OfficerImportCatalog): OfficerImportPreviewRow[] {
  const students = new Map(catalog.students.map((s) => [normalizeStudentId(s.studentId), s]));
  const portalByStudent = new Map(
    catalog.portalUsers
      .filter((u) => u.studentId)
      .map((u) => [normalizeStudentId(u.studentId), u]),
  );
  const portalEmails = new Set(catalog.portalUsers.map((u) => u.email.trim().toLowerCase()).filter(Boolean));
  const seenId = new Set<string>();
  const seenEmail = new Set<string>();
  const out: OfficerImportPreviewRow[] = [];

  for (const row of rows) {
    if (isOfficerExampleRow(row)) continue;
    const studentId = normalizeStudentId(row.studentId);
    const email = row.email.trim().toLowerCase();
    const preview: OfficerImportPreviewRow = { ...row, studentId, email, status: "Valid", message: "Ready to invite." };

    if (!studentId) {
      preview.status = "Invalid";
      preview.message = "Student ID is required.";
    } else if (!isValidStudentIdFormat(studentId)) {
      preview.status = "Invalid";
      preview.message = "Student ID must look like 23-0668.";
    } else if (!row.fullName.trim()) {
      preview.status = "Invalid";
      preview.message = "Full name is required.";
    } else if (!emailMeetsAdminPolicy(email, catalog.requireIsuEmail)) {
      preview.status = "Invalid";
      preview.message = catalog.requireIsuEmail ? ISU_EMAIL_ERROR : EMAIL_FORMAT_ERROR;
    } else if (!row.college.trim()) {
      preview.status = "Invalid";
      preview.message = "College is required.";
    } else if (!row.organization.trim()) {
      preview.status = "Invalid";
      preview.message = "Organization is required.";
    } else if (!row.program.trim()) {
      preview.status = "Invalid";
      preview.message = "Program is required.";
    } else if (!row.yearLevel.trim()) {
      preview.status = "Invalid";
      preview.message = "Year level is required.";
    } else if (!row.position.trim()) {
      preview.status = "Invalid";
      preview.message = "Position is required.";
    } else if (seenId.has(studentId)) {
      preview.status = "Invalid";
      preview.message = `Duplicate row: student ID ${studentId} appears more than once in this file.`;
    } else if (seenEmail.has(email)) {
      preview.status = "Invalid";
      preview.message = `Duplicate row: email ${email} appears more than once in this file.`;
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
      } else {
        const assigned = portalByStudent.get(studentId);
        if (assigned?.role === "student_officer") {
          preview.status = "Duplicate";
          preview.message = `Student ID ${studentId} is already assigned to a Student Officer.`;
        } else if (assigned?.role) {
          preview.status = "Invalid";
          preview.message = `Student ID ${studentId} already belongs to a ${assigned.role} account.`;
        } else {
          const collegeMatches = catalog.colleges.filter(
            (c) =>
              c.name.trim().toLowerCase() === row.college.trim().toLowerCase() ||
              (c.code ?? "").toLowerCase() === row.college.trim().toLowerCase(),
          );
          if (!collegeMatches.length) {
            preview.status = "Invalid";
            preview.message = `College "${row.college}" was not found.`;
          } else if (collegeMatches.length > 1) {
            preview.status = "Invalid";
            preview.message = `Multiple colleges match "${row.college}".`;
          } else {
            const college = collegeMatches[0]!;
            const orgKey = row.organization.trim().toLowerCase();
            const orgMatches = college.organizations.filter(
              (o) =>
                o.name.trim().toLowerCase() === orgKey ||
                (o.slug ?? "").toLowerCase() === orgKey ||
                normalizeOrgKey(o.name) === normalizeOrgKey(row.organization),
            );
            const inOtherCollege = catalog.colleges.some(
              (c) =>
                c !== college &&
                c.organizations.some(
                  (o) => o.name.trim().toLowerCase() === orgKey || (o.slug ?? "").toLowerCase() === orgKey,
                ),
            );
            if (!orgMatches.length && inOtherCollege) {
              preview.status = "Invalid";
              preview.message = `Organization "${row.organization}" does not belong to the selected college.`;
            } else if (!orgMatches.length) {
              preview.status = "Invalid";
              preview.message = `Organization "${row.organization}" was not found under "${college.name}".`;
            } else if (!registry) {
              preview.status = "Valid";
              preview.message = "Will create the Student Officer account and add this student to the registry.";
            } else {
              const mismatches: string[] = [];
              if (registry.fullName.trim().toLowerCase() !== row.fullName.trim().toLowerCase()) mismatches.push("name");
              if (row.program && registry.program.trim().toLowerCase() !== row.program.trim().toLowerCase()) {
                mismatches.push("program");
              }
              if (row.yearLevel && registry.yearLevel.trim().toLowerCase() !== row.yearLevel.trim().toLowerCase()) {
                mismatches.push("year level");
              }
              if (mismatches.length) {
                preview.status = "Warning";
                preview.message = `Student already exists but spreadsheet ${mismatches.join(", ")} differs from the registry and will not be overwritten.`;
              } else {
                preview.status = "Valid";
                preview.message = "Student exists and will be invited as Student Officer.";
              }
            }
          }
        }
      }
    }
    out.push(preview);
  }
  return out;
}

export function officerImportCanConfirm(rows: OfficerImportPreviewRow[]): boolean {
  return rows.some((r) => r.status === "Valid" || r.status === "Warning");
}
