import { getSupabase } from "@/lib/supabase";
import { countAdminPortalUsers, type AdminPortalUserRow } from "@/services/adminUsersDb";

export type AdminStatSnapshot = {
  totalUsers: number;
  portalRolesAssigned: number;
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

  const [totalUsers, pendingRes, orgsRes] = await Promise.all([
    countAdminPortalUsers(),
    supabase.from("event_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("organizations").select("id", { count: "exact", head: true }).eq("active", true),
  ]);

  return {
    totalUsers,
    portalRolesAssigned: totalUsers,
    pendingWorkflowItems: pendingRes.count ?? 0,
    activeOrganizations: orgsRes.count ?? 0,
  };
}

export async function fetchAdminRecentActivity(limit = 8): Promise<AdminActivityItem[]> {
  const supabase = getSupabase();
  const safeLimit = Math.min(20, Math.max(1, limit));

  const { data, error } = await supabase
    .from("event_request_history")
    .select("id, action, actor_id, created_at, request_id")
    .order("created_at", { ascending: false })
    .limit(safeLimit);
  if (error) throw error;

  const actorIds = [...new Set((data ?? []).map((r) => r.actor_id).filter(Boolean))] as string[];
  const userMap = new Map<string, AdminPortalUserRow>();
  if (actorIds.length) {
    // Pull a small page of users as a fallback directory; prefer profiles for names.
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .in("id", actorIds);
    for (const p of profiles ?? []) {
      userMap.set(String(p.id), {
        user_id: String(p.id),
        app_role: "admin",
        display_name: String(p.display_name ?? ""),
        email: String(p.email ?? ""),
        student_id: "",
        college: "",
        program: "",
      });
    }
  }

  return (data ?? []).map((row) => {
    const user = userMap.get(row.actor_id as string);
    const action = String(row.action ?? "updated").replace(/_/g, " ");
    return {
      id: String(row.id),
      action: action.charAt(0).toUpperCase() + action.slice(1),
      user: user?.display_name || user?.email || "Portal user",
      role: "Staff",
      time: relativeTime(String(row.created_at)),
    };
  });
}
