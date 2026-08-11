import { getSupabase } from "@/lib/supabase";
import type { AppRole } from "@/types/appRole";

export type AdminPortalUserRow = {
  user_id: string;
  app_role: AppRole;
  display_name: string;
  email: string;
  student_id: string;
  college: string;
  program: string;
};

const ROLE_LABEL: Record<AppRole, string> = {
  student: "Student",
  student_officer: "Student Officer",
  ssc: "SSC",
  adviser: "Adviser",
  dean: "Dean",
  osas: "OSAS",
  eo: "EO",
  gso: "GSO",
  it_infrastructure: "IT Infrastructure",
  sports_office: "Sports Office",
  admin: "Admin",
};

export function adminRoleLabel(role: string): string {
  return ROLE_LABEL[role as AppRole] ?? role;
}

export async function fetchAdminPortalUsers(): Promise<AdminPortalUserRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_list_portal_users");
  if (error) throw error;
  return (data ?? []) as AdminPortalUserRow[];
}
