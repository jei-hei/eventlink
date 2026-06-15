import { getSupabase } from "@/lib/supabase";

export type MyProfileRow = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string;
  student_id: string | null;
  organization_id: string | null;
  college_id: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  organizations: { name: string } | null;
  colleges: { name: string; code: string } | null;
  students: {
    full_name: string;
    course: string;
    program: string;
    year_level: string;
  } | null;
};

const PROFILE_SELECT = `
  id,
  display_name,
  email,
  phone,
  student_id,
  organization_id,
  college_id,
  avatar_url,
  created_at,
  updated_at,
  organizations ( name ),
  colleges ( name, code )
`;

/** Creates public.profiles + default role if missing (auth user without trigger row). */
export async function ensureMyProfileRow(): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc("ensure_my_profile");
  if (error) throw error;
}

export async function fetchMyProfile(userId: string): Promise<MyProfileRow | null> {
  const supabase = getSupabase();
  await ensureMyProfileRow();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!profile) return null;

  let students: MyProfileRow["students"] = null;
  const studentId = (profile as { student_id?: string | null }).student_id;
  if (studentId) {
    const { data: row, error: studentErr } = await supabase
      .from("students")
      .select("full_name, course, program, year_level")
      .eq("student_id", studentId)
      .maybeSingle();
    if (!studentErr && row) {
      students = row as MyProfileRow["students"];
    }
  }

  const row = profile as Record<string, unknown>;
  const org = row.organizations;
  const college = row.colleges;

  return {
    id: row.id as string,
    display_name: row.display_name as string,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string) ?? "",
    student_id: (row.student_id as string | null) ?? null,
    organization_id: (row.organization_id as string | null) ?? null,
    college_id: (row.college_id as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    organizations: Array.isArray(org) ? (org[0] as { name: string }) ?? null : (org as { name: string } | null),
    colleges: Array.isArray(college)
      ? (college[0] as { name: string; code: string }) ?? null
      : (college as { name: string; code: string } | null),
    students,
  };
}

export type UpdateMyProfileInput = {
  displayName?: string;
  phone?: string;
  email?: string;
};

export async function updateMyProfile(userId: string, input: UpdateMyProfileInput): Promise<void> {
  const body: Record<string, string> = {};
  if (input.displayName !== undefined) body.display_name = input.displayName.trim();
  if (input.phone !== undefined) body.phone = input.phone.trim();
  if (input.email !== undefined) body.email = input.email.trim();

  if (!Object.keys(body).length) return;

  const supabase = getSupabase();
  const { error } = await supabase.from("profiles").update(body).eq("id", userId);
  if (error) throw error;
}
