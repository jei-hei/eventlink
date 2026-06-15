import { getSupabase } from "@/lib/supabase";
import type { MasterStudent } from "@/types/studentRegistry";
import { isValidStudentIdFormat, normalizeStudentId } from "@/types/studentRegistry";

export type StudentDbRow = {
  student_id: string;
  full_name: string;
  course: string;
  program: string;
  year_level: string;
  email: string | null;
  archived: boolean;
};

export function masterStudentFromDb(row: StudentDbRow): MasterStudent {
  return {
    id: row.student_id,
    studentId: row.student_id,
    fullName: row.full_name,
    course: row.course ?? "",
    program: row.program ?? "",
    yearLevel: row.year_level ?? "",
    email: row.email ?? undefined,
    archived: row.archived,
  };
}

export function masterStudentToDb(row: MasterStudent): StudentDbRow {
  return {
    student_id: normalizeStudentId(row.studentId),
    full_name: row.fullName.trim(),
    course: row.course?.trim() ?? "",
    program: row.program?.trim() ?? "",
    year_level: row.yearLevel?.trim() ?? "",
    email: row.email?.trim() || null,
    archived: row.archived ?? false,
  };
}

export async function fetchAllStudents(): Promise<MasterStudent[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("students")
    .select("student_id, full_name, course, program, year_level, email, archived")
    .order("student_id", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((r) => masterStudentFromDb(r as StudentDbRow));
}

export async function upsertStudents(rows: MasterStudent[]): Promise<number> {
  const payloads = rows
    .map(masterStudentToDb)
    .filter((r) => isValidStudentIdFormat(r.student_id) && r.full_name.length > 0);

  if (!payloads.length) return 0;

  const supabase = getSupabase();
  const { error } = await supabase.from("students").upsert(payloads, { onConflict: "student_id" });
  if (error) throw error;
  return payloads.length;
}

export async function updateStudentById(
  studentId: string,
  patch: Partial<MasterStudent>,
): Promise<void> {
  const id = normalizeStudentId(studentId);
  const body: Partial<StudentDbRow> = {};
  if (patch.fullName !== undefined) body.full_name = patch.fullName.trim();
  if (patch.course !== undefined) body.course = patch.course.trim();
  if (patch.program !== undefined) body.program = patch.program.trim();
  if (patch.yearLevel !== undefined) body.year_level = patch.yearLevel.trim();
  if (patch.email !== undefined) body.email = patch.email.trim() || null;
  if (patch.archived !== undefined) body.archived = patch.archived;

  const supabase = getSupabase();
  const { error } = await supabase.from("students").update(body).eq("student_id", id);
  if (error) throw error;
}
