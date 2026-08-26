import { getSupabase } from "@/lib/supabase";
import { fetchAdminPortalUsers, type AdminPortalUserRow } from "@/services/adminUsersDb";

export type AdminStatSnapshot = {
  totalUsers: number;
  studentsRegistered: number;
  pendingWorkflowItems: number;
  activeOrganizations: number;
};

export type AdminActivityItem = {
  id: string;
  action: string;
  user: string;
  role: string;
  time: string;
};

function relativeTime(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const mins = Math.floor(Math.max(0, now - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins > 1 ? "s" : ""} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export async function fetchAdminStatsSnapshot(): Promise<AdminStatSnapshot> {
  const supabase = getSupabase();
  const users = await fetchAdminPortalUsers();

  const [{ count: studentCount }, { count: pendingCount }, orgsRes] = await Promise.all([
    supabase.from("students").select("student_id", { count: "exact", head: true }).eq("archived", false),
    supabase.from("event_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("organizations").select("id").eq("active", true),
  ]);

  return {
    totalUsers: users.length,
    studentsRegistered: studentCount ?? 0,
    pendingWorkflowItems: pendingCount ?? 0,
    activeOrganizations: (orgsRes.data ?? []).length,
  };
}

export async function fetchAdminRecentActivity(limit = 8): Promise<AdminActivityItem[]> {
  const supabase = getSupabase();
  const users = await fetchAdminPortalUsers();
  const userMap = new Map<string, AdminPortalUserRow>();
  users.forEach((u) => userMap.set(u.user_id, u));

  const { data, error } = await supabase
    .from("event_request_history")
    .select("id, action, actor_id, created_at, request_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((row) => {
    const user = userMap.get(row.actor_id as string);
    const action = String(row.action ?? "updated").replace(/_/g, " ");
    const role = user?.app_role?.replace(/_/g, " ") ?? "Staff";
    return {
      id: String(row.id),
      action: action.charAt(0).toUpperCase() + action.slice(1),
      user: user?.display_name || user?.email || "Portal user",
      role,
      time: relativeTime(String(row.created_at)),
    };
  });
}
