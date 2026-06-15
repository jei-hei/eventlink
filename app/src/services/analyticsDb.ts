import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export type AnalyticsScope = "ssc" | "student_officer" | "eo" | "adviser" | "dean" | "osas" | "gso";

type RequestRow = {
  id: string;
  activity: string;
  request_type: "ssc" | "student_officer" | "eo_direct";
  status: "pending" | "approved" | "declined" | "posted";
  current_step: string | null;
  created_at: string;
  organizations?: { name: string | null }[] | { name: string | null } | null;
};

export type MonthlyPoint = {
  id: string;
  month: string;
  events: number;
  approved: number;
  rejected: number;
};

export type StatusSlice = {
  name: "Approved" | "Pending" | "Rejected";
  value: number;
  color: string;
};

export type ActivityItem = {
  id: number;
  action: "Approved" | "Rejected" | "Pending";
  event: string;
  time: string;
  org: string;
  icon: string;
};

export type StatTotals = {
  totalThisYear: number;
  approvedThisMonth: number;
  approvedLastMonth: number;
  pendingCount: number;
  awaitingPublishCount: number;
  allTimeCount: number;
};

export type OrganizationPoint = { org: string; events: number };

export type AnalyticsOverview = {
  monthlyEvents: MonthlyPoint[];
  eventStatusData: StatusSlice[];
  recentActivity: ActivityItem[];
  organizationData: OrganizationPoint[];
  totals: StatTotals;
  peakMonthLabel: string;
};

function monthLabel(d: Date): string {
  return d.toLocaleString("en-US", { month: "short" });
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function isApprovedLike(status: RequestRow["status"]): boolean {
  return status === "approved" || status === "posted";
}

function actionFromStatus(status: RequestRow["status"]): ActivityItem["action"] {
  if (status === "declined") return "Rejected";
  if (status === "pending") return "Pending";
  return "Approved";
}

function iconForAction(action: ActivityItem["action"]): string {
  if (action === "Approved") return "✅";
  if (action === "Rejected") return "❌";
  return "⏳";
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const deltaMs = Math.max(0, now - t);
  const mins = Math.floor(deltaMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins > 1 ? "s" : ""} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function organizationName(row: RequestRow): string {
  const raw = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
  const name = raw?.name?.trim();
  return name || "Organization";
}

function emptyOverview(): AnalyticsOverview {
  return {
    monthlyEvents: [],
    eventStatusData: [
      { name: "Approved", value: 0, color: "#4ADE80" },
      { name: "Pending", value: 0, color: "#D97706" },
      { name: "Rejected", value: 0, color: "#DC2626" },
    ],
    recentActivity: [],
    organizationData: [],
    totals: {
      totalThisYear: 0,
      approvedThisMonth: 0,
      approvedLastMonth: 0,
      pendingCount: 0,
      awaitingPublishCount: 0,
      allTimeCount: 0,
    },
    peakMonthLabel: "No data yet",
  };
}

export async function fetchAnalyticsOverview(scope: AnalyticsScope): Promise<AnalyticsOverview> {
  if (!isSupabaseConfigured) return emptyOverview();

  const supabase = getSupabase();
  let query = supabase
    .from("event_requests")
    .select("id, activity, request_type, status, current_step, created_at, organizations(name)")
    .order("created_at", { ascending: false });

  if (scope === "ssc" || scope === "student_officer") {
    query = query.eq("request_type", scope);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as RequestRow[];
  if (!rows.length) return emptyOverview();

  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const lastMonthStart = new Date(thisMonthStart.getFullYear(), thisMonthStart.getMonth() - 1, 1);
  const nextMonthStart = new Date(thisMonthStart.getFullYear(), thisMonthStart.getMonth() + 1, 1);

  const months: Date[] = [];
  for (let i = 5; i >= 0; i--) {
    months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }
  const monthMap = new Map<string, MonthlyPoint>();
  months.forEach((m) => {
    const key = `${m.getFullYear()}-${m.getMonth()}`;
    monthMap.set(key, { id: key, month: monthLabel(m), events: 0, approved: 0, rejected: 0 });
  });

  const orgMap = new Map<string, number>();
  let approved = 0;
  let pending = 0;
  let rejected = 0;
  let totalThisYear = 0;
  let approvedThisMonth = 0;
  let approvedLastMonth = 0;
  let awaitingPublish = 0;

  rows.forEach((row) => {
    const d = new Date(row.created_at);
    if (d.getFullYear() === now.getFullYear()) totalThisYear += 1;

    const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
    const point = monthMap.get(monthKey);
    if (point) {
      point.events += 1;
      if (isApprovedLike(row.status)) point.approved += 1;
      if (row.status === "declined") point.rejected += 1;
    }

    if (isApprovedLike(row.status)) {
      approved += 1;
      if (d >= thisMonthStart && d < nextMonthStart) approvedThisMonth += 1;
      if (d >= lastMonthStart && d < thisMonthStart) approvedLastMonth += 1;
    } else if (row.status === "declined") {
      rejected += 1;
    } else {
      pending += 1;
    }

    if (
      row.current_step === "eo_publish" &&
      (row.status === "pending" || row.status === "approved")
    ) {
      awaitingPublish += 1;
    }

    const orgName = organizationName(row);
    orgMap.set(orgName, (orgMap.get(orgName) ?? 0) + 1);
  });

  const monthlyEvents = Array.from(monthMap.values());
  const peak = monthlyEvents.reduce((a, b) => (a.events >= b.events ? a : b), monthlyEvents[0]!);
  const peakMonthLabel = peak && peak.events > 0 ? `${peak.month} ${now.getFullYear()}` : "No data yet";

  const recentActivity = rows.slice(0, 5).map((row, idx) => {
    const action = actionFromStatus(row.status);
    return {
      id: idx + 1,
      action,
      event: row.activity || "Untitled event",
      time: relativeTime(row.created_at),
      org: organizationName(row),
      icon: iconForAction(action),
    } satisfies ActivityItem;
  });

  const organizationData = Array.from(orgMap.entries())
    .map(([org, events]) => ({ org, events }))
    .sort((a, b) => b.events - a.events)
    .slice(0, 6);

  return {
    monthlyEvents,
    eventStatusData: [
      { name: "Approved", value: approved, color: "#4ADE80" },
      { name: "Pending", value: pending, color: "#D97706" },
      { name: "Rejected", value: rejected, color: "#DC2626" },
    ],
    recentActivity,
    organizationData,
    totals: {
      totalThisYear,
      approvedThisMonth,
      approvedLastMonth,
      pendingCount: pending,
      awaitingPublishCount: awaitingPublish,
      allTimeCount: rows.length,
    },
    peakMonthLabel,
  };
}
