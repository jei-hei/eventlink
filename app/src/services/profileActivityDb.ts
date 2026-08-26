import { getSupabase } from "@/lib/supabase";
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

  if (role === "student") {
    const [{ count: postedCount }, { count: calendarCount }, { count: notifCount }] = await Promise.all([
      supabase.from("event_requests").select("id", { head: true, count: "exact" }).eq("status", "posted"),
      supabase
        .from("event_requests")
        .select("id", { head: true, count: "exact" })
        .not("calendar_posted_at", "is", null),
      supabase.from("notifications").select("id", { head: true, count: "exact" }).eq("user_id", userId),
    ]);
    return [
      makeStat("joined", "Posted events", postedCount ?? 0, "CalendarCheck"),
      makeStat("saved", "Calendar events", calendarCount ?? 0, "Bookmark"),
      makeStat("feedback", "Your notifications", notifCount ?? 0, "MessageSquare"),
    ];
  }

  const [{ count: approvedCount }, { count: pendingCount }, { count: scheduledCount }] = await Promise.all([
    supabase
      .from("event_request_history")
      .select("id", { head: true, count: "exact" })
      .eq("actor_id", userId)
      .eq("action", "approved"),
    supabase.from("event_requests").select("id", { head: true, count: "exact" }).eq("status", "pending"),
    supabase
      .from("event_requests")
      .select("id", { head: true, count: "exact" })
      .not("calendar_posted_at", "is", null),
  ]);

  return [
    makeStat("approved", "Approved requests", approvedCount ?? 0, "CheckCircle"),
    makeStat("pending", "Pending reviews", pendingCount ?? 0, "Clock"),
    makeStat("scheduled", "Scheduled events", scheduledCount ?? 0, "Calendar"),
  ];
}
