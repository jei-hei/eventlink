import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export type AnalyticsScope =
  | "ssc"
  | "student_officer"
  | "eo"
  | "adviser"
  | "dean"
  | "osas"
  | "gso"
  | "it_infrastructure"
  | "sports_office";

export type AnalyticsScopeOptions = {
  /** profiles.college_id — required for adviser/dean */
  collegeId?: string | null;
  /** profiles.organization_id — required for student_officer (preferred) */
  organizationId?: string | null;
  /** auth user id — fallback for student_officer when org is missing */
  userId?: string | null;
};

type RequestRow = {
  id: string;
  activity: string;
  request_type: "ssc" | "student_officer" | "eo_direct";
  status: "pending" | "approved" | "declined" | "posted";
  current_step: string | null;
  created_at: string;
  organization_id?: string | null;
  organizations?:
    | { name: string | null; college_id?: string | null }[]
    | { name: string | null; college_id?: string | null }
    | null;
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
export type CollegePoint = { college: string; events: number };

export type AnalyticsOverview = {
  monthlyEvents: MonthlyPoint[];
  eventStatusData: StatusSlice[];
  recentActivity: ActivityItem[];
  organizationData: OrganizationPoint[];
  collegeData: CollegePoint[];
  totals: StatTotals;
  peakMonthLabel: string;
};

type ResourceOffice = "gso" | "it_infrastructure" | "sports_office";

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
    collegeData: [],
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

function isResourceOfficeScope(scope: AnalyticsScope): scope is ResourceOffice {
  return scope === "gso" || scope === "it_infrastructure" || scope === "sports_office";
}

/**
 * Resolve request IDs that involve a resource office (assignment-based).
 * GSO also includes legacy current_step = gso requests.
 */
async function fetchResourceOfficeRequestIds(office: ResourceOffice): Promise<string[] | null> {
  const supabase = getSupabase();
  let assignmentQuery = supabase
    .from("event_request_resource_assignments")
    .select("request_id")
    .eq("assigned_office", office);

  if (office === "it_infrastructure") {
    assignmentQuery = assignmentQuery.eq("resource_kind", "equipment");
  } else if (office === "sports_office") {
    assignmentQuery = assignmentQuery.eq("resource_kind", "venue");
  }

  const { data: assignmentRows, error: assignmentErr } = await assignmentQuery;
  if (assignmentErr) throw assignmentErr;

  const ids = new Set<string>(
    ((assignmentRows ?? []) as Array<{ request_id: string | null }>)
      .map((r) => r.request_id)
      .filter((id): id is string => !!id),
  );

  if (office === "gso") {
    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);
    const { data: legacyRows, error: legacyErr } = await supabase
      .from("event_requests")
      .select("id")
      .eq("current_step", "gso")
      .gte("created_at", since.toISOString())
      .limit(500);
    if (legacyErr) throw legacyErr;
    for (const row of (legacyRows ?? []) as Array<{ id: string }>) {
      if (row.id) ids.add(row.id);
    }
  }

  return [...ids];
}

function buildOverview(rows: RequestRow[], collegeNameById: Map<string, string>): AnalyticsOverview {
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
  const collegeMap = new Map<string, number>();
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

    const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    const collegeName = org?.college_id
      ? (collegeNameById.get(org.college_id) ?? "Unassigned College")
      : "Unassigned College";
    collegeMap.set(collegeName, (collegeMap.get(collegeName) ?? 0) + 1);
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
  const collegeData = Array.from(collegeMap.entries())
    .map(([college, events]) => ({ college, events }))
    .sort((a, b) => b.events - a.events)
    .slice(0, 8);

  return {
    monthlyEvents,
    eventStatusData: [
      { name: "Approved", value: approved, color: "#4ADE80" },
      { name: "Pending", value: pending, color: "#D97706" },
      { name: "Rejected", value: rejected, color: "#DC2626" },
    ],
    recentActivity,
    organizationData,
    collegeData,
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

/**
 * Role-scoped analytics. Filters are applied in the query (or request-id prefilter),
 * then all cards/charts/tables are computed only from that authorized set.
 */
export async function fetchAnalyticsOverview(
  scope: AnalyticsScope,
  options: AnalyticsScopeOptions = {},
): Promise<AnalyticsOverview> {
  if (!isSupabaseConfigured) return emptyOverview();

  const collegeId = options.collegeId?.trim() || null;
  const organizationId = options.organizationId?.trim() || null;
  const userId = options.userId?.trim() || null;

  // Missing required scope keys must not fall back to campus-wide data.
  if (scope === "dean" && !collegeId) {
    return emptyOverview();
  }
  if (scope === "adviser" && !collegeId && !organizationId) {
    return emptyOverview();
  }
  if (scope === "student_officer" && !organizationId && !userId) {
    return emptyOverview();
  }

  const supabase = getSupabase();
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const sinceIso = since.toISOString();

  const useInnerOrg = scope === "dean" || (scope === "adviser" && !!collegeId);
  const orgSelect = useInnerOrg
    ? "organizations!inner(name, college_id)"
    : "organizations(name, college_id)";

  let query = supabase
    .from("event_requests")
    .select(
      `id, activity, request_type, status, current_step, created_at, organization_id, ${orgSelect}`,
    )
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(500);

  if (scope === "ssc") {
    query = query.eq("request_type", "ssc");
  } else if (scope === "student_officer") {
    query = query.eq("request_type", "student_officer");
    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    } else if (userId) {
      query = query.eq("submitted_by", userId);
    }
  } else if (scope === "dean") {
    query = query.eq("organizations.college_id", collegeId!);
  } else if (scope === "adviser") {
    // Prefer college scope (all orgs in the adviser's college). Fall back to own org only.
    if (collegeId) {
      query = query.eq("organizations.college_id", collegeId);
    } else if (organizationId) {
      query = query.eq("organization_id", organizationId);
    }
  } else if (isResourceOfficeScope(scope)) {
    const requestIds = await fetchResourceOfficeRequestIds(scope);
    if (!requestIds || requestIds.length === 0) {
      return emptyOverview();
    }
    const capped = requestIds.slice(0, 500);
    query = query.in("id", capped);
  }
  // eo / osas: campus-wide (matches workflow visibility) — no college filter

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as RequestRow[];

  const { data: collegeRows } = await supabase.from("colleges").select("id, name");
  const collegeNameById = new Map<string, string>(
    ((collegeRows ?? []) as Array<{ id: string; name: string | null }>).map((c) => [
      c.id,
      c.name?.trim() || "College",
    ]),
  );

  return buildOverview(rows, collegeNameById);
}
