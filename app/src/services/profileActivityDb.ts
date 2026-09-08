import { getSupabase } from "@/lib/supabase";
import { countPendingForRole } from "@/services/eventRequestsDb";
import type { AppRole } from "@/types/appRole";
import type { ActivityStatModel } from "@/types/portalProfile";

function makeStat(id: string, label: string, value: number, icon: ActivityStatModel["icon"]): ActivityStatModel {
  return { id, label, value: Math.max(0, Number(value || 0)), icon };
}

export async function fetchProfileActivityStats(role: AppRole, userId: string): Promise<ActivityStatModel[]> {
  const supabase = getSupabase();

  if (role === "admin") {
    const [{ count: usersCount }, orgsRes, { count: eventsCount }] = await Promise.all([
      supabase.from("user_roles").select("user_id", { head: true, count: "exact" }),
      supabase.from("organizations").select("id"),
      supabase.from("event_requests").select("id", { head: true, count: "exact" }),
    ]);
    return [
      makeStat("users", "Managed users", usersCount ?? 0, "Users"),
      makeStat("orgs", "Active organizations", (orgsRes.data ?? []).length, "Building2"),
      makeStat("events", "Total events", eventsCount ?? 0, "LayoutDashboard"),
    ];
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("college_id, organization_id")
    .eq("id", userId)
    .maybeSingle();

  const [{ count: approvedCount }, pendingCount, { count: scheduledCount }] = await Promise.all([
    supabase
      .from("event_request_history")
      .select("id", { head: true, count: "exact" })
      .eq("actor_id", userId)
      .eq("action", "approved"),
    countPendingForRole(role, userId, {
      collegeId: profile?.college_id ?? null,
      organizationId: profile?.organization_id ?? null,
    }),
    supabase
      .from("event_requests")
      .select("id", { head: true, count: "exact" })
      .not("calendar_posted_at", "is", null),
  ]);

  return [
    makeStat("approved", "Approved requests", approvedCount ?? 0, "CheckCircle"),
    makeStat("pending", "Pending reviews", pendingCount, "Clock"),
    makeStat("scheduled", "Scheduled events", scheduledCount ?? 0, "Calendar"),
  ];
}
