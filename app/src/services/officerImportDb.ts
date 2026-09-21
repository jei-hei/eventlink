import { getSupabase } from "@/lib/supabase";
import { fetchCollegesWithOrganizations } from "@/services/collegesDb";
import { fetchRequireIsuEmail } from "@/services/appSettingsDb";
import type { OfficerImportCatalog, OfficerImportPreviewRow } from "@/services/officerImportParser";
import { normalizeStudentId } from "@/types/studentRegistry";
import type { AdminPortalUserRow } from "@/services/adminUsersDb";

export type OfficerImportRowResult = {
  row: number;
  student_id: string;
  full_name: string;
  email: string;
  college: string;
  organization: string;
  position: string;
  status: string;
  message: string;
};

export type OfficerImportResult = {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  invitations: number;
  rows: OfficerImportRowResult[];
};

export async function fetchOfficerImportCatalog(studentIds: string[]): Promise<OfficerImportCatalog> {
  const supabase = getSupabase();
  const ids = [...new Set(studentIds.map(normalizeStudentId).filter(Boolean))];
  const [requireIsuEmail, colleges, studentsRes, usersRes] = await Promise.all([
    fetchRequireIsuEmail().catch(() => true),
    fetchCollegesWithOrganizations(),
    ids.length
      ? supabase
          .from("students")
          .select("student_id, full_name, course, program, year_level, archived")
          .in("student_id", ids)
      : Promise.resolve({ data: [], error: null }),
    supabase.rpc("admin_list_portal_users"),
  ]);
  if (studentsRes.error) throw studentsRes.error;
  if (usersRes.error) throw usersRes.error;

  const portalUsers = ((usersRes.data ?? []) as AdminPortalUserRow[]).map((u) => ({
    email: u.email ?? "",
    studentId: u.student_id ?? "",
    role: String(u.app_role ?? ""),
  }));

  return {
    requireIsuEmail,
    colleges: colleges.map((c) => ({
      name: c.name,
      code: c.code,
      organizations: c.organizations.map((o) => ({ name: o.name, slug: o.slug })),
    })),
    students: ((studentsRes.data ?? []) as Array<{
      student_id: string;
      full_name: string;
      course: string;
      program: string;
      year_level: string;
      archived: boolean;
    }>).map((s) => ({
      studentId: s.student_id,
      fullName: s.full_name,
      course: s.course ?? "",
      program: s.program ?? "",
      yearLevel: s.year_level ?? "",
      archived: s.archived,
    })),
    portalUsers,
  };
}

export async function importStudentOfficers(rows: OfficerImportPreviewRow[]): Promise<OfficerImportResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke("admin-bulk-provision", {
    body: {
      role: "student_officer",
      rows: rows.map((row) => ({
        row: row.row,
        student_id: row.studentId,
        full_name: row.fullName,
        email: row.email,
        college: row.college,
        program: row.program,
        year_level: row.yearLevel,
        organization: row.organization,
        position: row.position,
      })),
    },
  });

  const payload = data as (Partial<OfficerImportResult> & { ok?: boolean; error?: string }) | null;
  if (payload?.error) {
    throw new Error(payload.error);
  }
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("failed to send a request") || msg.includes("non-2xx") || msg.includes("not found")) {
      throw new Error("Admin bulk-provision function is not available. Deploy supabase function: admin-bulk-provision.");
    }
    throw new Error("Import failed. Some rows may not have been processed.");
  }
  if (!payload) {
    throw new Error("Import failed. No response from the server.");
  }

  return {
    total: payload.total ?? rows.length,
    successful: payload.successful ?? 0,
    failed: payload.failed ?? 0,
    skipped: payload.skipped ?? 0,
    invitations: payload.invitations ?? 0,
    rows: payload.rows ?? [],
  };
}
