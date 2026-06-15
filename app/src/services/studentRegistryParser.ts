import type { MasterStudent } from "@/types/studentRegistry";
import { normalizeStudentId } from "@/types/studentRegistry";

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

type HeaderField = "student_id" | "full_name" | "course" | "program" | "year_level" | "email";

function headerKey(h: string): HeaderField | null {
  const x = normalizeHeader(h);
  if (["student_id", "studentid", "id", "student_no", "student_no."].includes(x)) return "student_id";
  if (["full_name", "fullname", "name", "student_name"].includes(x)) return "full_name";
  if (["course", "college"].includes(x)) return "course";
  if (["program", "degree", "programme"].includes(x)) return "program";
  if (["year_level", "yearlevel", "year", "level"].includes(x)) return "year_level";
  if (["email", "e_mail", "e-mail"].includes(x)) return "email";
  return null;
}

function rowFromCells(
  cells: string[],
  headerMap: { index: number; key: HeaderField }[],
  rowIndex: number,
): MasterStudent | null {
  const obj: Partial<Record<HeaderField, string>> = {};
  for (const { index, key } of headerMap) {
    obj[key] = cells[index] ?? "";
  }
  const studentId = normalizeStudentId(obj.student_id ?? "");
  const fullName = (obj.full_name ?? "").trim();
  if (!studentId && !fullName) return null;

  return {
    id: `import-${rowIndex}-${studentId || fullName}`,
    studentId,
    fullName,
    course: (obj.course ?? "").trim(),
    program: (obj.program ?? "").trim(),
    yearLevel: (obj.year_level ?? "").trim(),
    email: (obj.email ?? "").trim() || undefined,
    sourceRow: rowIndex,
  };
}

export function parseRegistryCsv(text: string): MasterStudent[] {
  const rawLines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (rawLines.length < 2) return [];

  const headerCells = splitCsvLine(rawLines[0]!);
  const headerMap: { index: number; key: HeaderField }[] = [];
  headerCells.forEach((h, index) => {
    const k = headerKey(h);
    if (k) headerMap.push({ index, key: k });
  });

  const rows: MasterStudent[] = [];
  for (let i = 1; i < rawLines.length; i++) {
    const cells = splitCsvLine(rawLines[i]!);
    const r = rowFromCells(cells, headerMap, i + 1);
    if (r) rows.push(r);
  }
  return rows;
}

function cell(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  return "";
}

/** Loads `xlsx` on demand to keep initial bundles small. */
export async function parseRegistryXlsx(buffer: ArrayBuffer): Promise<MasterStudent[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  if (!sheet) return [];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const rows: MasterStudent[] = [];
  json.forEach((row, i) => {
    const studentId = normalizeStudentId(
      cell(row, ["student_id", "Student ID", "studentId", "STUDENT_ID", "id", "ID"]),
    );
    const fullName = cell(row, ["full_name", "Full Name", "fullname", "name", "NAME"]);
    if (!studentId && !fullName) return;
    rows.push({
      id: `xlsx-${i}-${studentId}`,
      studentId,
      fullName,
      course: cell(row, ["college", "College", "COLLEGE", "course", "Course", "COURSE"]),
      program: cell(row, ["program", "Program", "PROGRAM"]),
      yearLevel: cell(row, ["year_level", "Year Level", "yearLevel", "year"]),
      email: cell(row, ["email", "Email", "EMAIL"]) || undefined,
      sourceRow: i + 2,
    });
  });
  return rows;
}

export function findDuplicateStudentIds(rows: MasterStudent[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  rows.forEach((r, i) => {
    const id = normalizeStudentId(r.studentId);
    if (!id) return;
    const arr = map.get(id) ?? [];
    arr.push(i);
    map.set(id, arr);
  });
  const dups = new Map<string, number[]>();
  map.forEach((indices, id) => {
    if (indices.length > 1) dups.set(id, indices);
  });
  return dups;
}
