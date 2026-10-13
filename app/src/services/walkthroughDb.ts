import { getSupabase } from "@/lib/supabase";
import type { AppRole } from "@/types/appRole";

export type WalkthroughAccountChoice = {
  userId: string;
  displayName: string;
  collegeName: string;
  organizationName: string;
  program: string;
};

export type OpenedWalkthroughPortal = {
  role: AppRole;
  collegeId: string | null;
  organizationId: string | null;
  subjectName: string;
  place: string;
};

type AccountRow = {
  user_id: string;
  display_name: string;
  college_name: string;
  organization_name: string;
  program: string;
};

type OpenedRow = {
  role: AppRole;
  college_id: string | null;
  organization_id: string | null;
  subject_name: string;
  place: string;
};

export type WalkthroughSessionState = {
  isWalkthrough: boolean;
  enabled: boolean;
  subjectName: string;
  place: string;
};

export async function fetchWalkthroughSession(): Promise<WalkthroughSessionState> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("walkthrough_session");
  if (error) {
    if (/walkthrough_session|is_walkthrough/i.test(error.message)) {
      return { isWalkthrough: false, enabled: false, subjectName: "", place: "" };
    }
    throw error;
  }
  const row = (Array.isArray(data) ? data[0] : data) as {
    is_walkthrough?: boolean;
    enabled?: boolean;
    subject_name?: string;
    place?: string;
  } | null;
  return {
    isWalkthrough: row?.is_walkthrough === true,
    enabled: row?.enabled === true,
    subjectName: row?.subject_name ?? "",
    place: row?.place ?? "",
  };
}

export async function listWalkthroughAccounts(role: AppRole): Promise<WalkthroughAccountChoice[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("list_walkthrough_accounts", { p_role: role });
  if (error) throw error;
  const rows = (Array.isArray(data) ? data : []) as AccountRow[];
  return rows.map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    collegeName: row.college_name,
    organizationName: row.organization_name,
    program: row.program,
  }));
}

export async function openWalkthroughPortal(userId: string): Promise<OpenedWalkthroughPortal> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("open_walkthrough_portal", { p_user_id: userId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as OpenedRow | null;
  if (!row?.role) throw new Error("That account could not be opened.");
  return {
    role: row.role,
    collegeId: row.college_id,
    organizationId: row.organization_id,
    subjectName: row.subject_name,
    place: row.place,
  };
}
