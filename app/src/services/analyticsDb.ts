import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { countPendingForRole } from "@/services/eventRequestsDb";
import { parseSdgsFromStorage, sdgLabel } from "@/constants/sdgs";
import type { AppRole } from "@/types/appRole";

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
  status: "pending" | "approved" | "declined" | "posted";
  current_step: string | null;
  created_at: string;
  sdgs?: string | null;
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
export type SdgUsagePoint = { id: number; name: string; value: number; color: string };

export type AnalyticsOverview = {
  monthlyEvents: MonthlyPoint[];
  eventStatusData: StatusSlice[];
  recentActivity: ActivityItem[];
  organizationData: OrganizationPoint[];
  collegeData: CollegePoint[];
  sdgUsage: SdgUsagePoint[];
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
    sdgUsage: [],
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
  const pageSize = 500;
  const ids = new Set<string>();
  for (let from = 0; ; from += pageSize) {
    let assignmentQuery = supabase
      .from("event_request_resource_assignments")
      .select("request_id")
      .eq("assigned_office", office)
      .order("request_id", { ascending: true })
      .order("id", { ascending: true });

    if (office === "it_infrastructure") {
      assignmentQuery = assignmentQuery.eq("resource_kind", "equipment");
    } else if (office === "sports_office") {
      assignmentQuery = assignmentQuery.eq("resource_kind", "venue");
    }

    const { data, error } = await assignmentQuery.range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as Array<{ request_id: string | null }>;
    rows.forEach((row) => {
      if (row.request_id) ids.add(row.request_id);
    });
    if (rows.length < pageSize) break;
  }

  if (office === "gso") {
    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("event_requests")
        .select("id")
        .eq("current_step", "gso")
        .is("deleted_at", null)
        .gte("created_at", since.toISOString())
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const rows = (data ?? []) as Array<{ id: string }>;
      rows.forEach((row) => ids.add(row.id));
      if (rows.length < pageSize) break;
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
  const sdgMap = new Map<number, number>();
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

    for (const sdgId of parseSdgsFromStorage(row.sdgs)) {
      sdgMap.set(sdgId, (sdgMap.get(sdgId) ?? 0) + 1);
    }
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
  const sdgColors = ["#16A34A", "#0D9488", "#2563EB", "#D97706", "#7C3AED", "#DC2626"];
  const sdgUsage = Array.from(sdgMap.entries())
    .map(([id, value]) => ({ id, name: sdgLabel(id), value }))
    .sort((a, b) => b.value - a.value || a.id - b.id)
    .slice(0, 6)
    .map((item, index) => ({ ...item, color: sdgColors[index % sdgColors.length]! }));

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
    sdgUsage,
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

  let resourceRequestIds: string[] | null = null;
  if (isResourceOfficeScope(scope)) {
    resourceRequestIds = await fetchResourceOfficeRequestIds(scope);
    if (!resourceRequestIds || !resourceRequestIds.length) {
      const overview = emptyOverview();
      const pendingCount = await countPendingForRole(scope as AppRole, userId ?? "", {
        collegeId,
        organizationId,
      });
      overview.totals.pendingCount = pendingCount;
      const pendingSlice = overview.eventStatusData.find((slice) => slice.name === "Pending");
      if (pendingSlice) pendingSlice.value = pendingCount;
      return overview;
    }
  }
  // eo / osas: campus-wide (matches workflow visibility) — no college filter

  function buildQuery(idChunk?: string[]) {
    let query = supabase
      .from("event_requests")
      .select(
        `id, activity, status, current_step, created_at, sdgs, ${orgSelect}`,
      )
      .is("deleted_at", null)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (scope === "ssc") {
      query = query.eq("request_type", "ssc");
    } else if (scope === "student_officer") {
      query = query.eq("request_type", "student_officer");
      if (organizationId) query = query.eq("organization_id", organizationId);
      else if (userId) query = query.eq("submitted_by", userId);
    } else if (scope === "dean") {
      query = query.eq("organizations.college_id", collegeId!);
    } else if (scope === "adviser") {
      if (collegeId) query = query.eq("organizations.college_id", collegeId);
      else if (organizationId) query = query.eq("organization_id", organizationId);
    }
    if (idChunk?.length) query = query.in("id", idChunk);
    return query;
  }

  const pageSize = 500;
  const idChunks = resourceRequestIds
    ? Array.from(
        { length: Math.ceil(resourceRequestIds.length / pageSize) },
        (_, index) => resourceRequestIds!.slice(index * pageSize, (index + 1) * pageSize),
      )
    : [undefined];
  const rowsById = new Map<string, RequestRow>();
  for (const idChunk of idChunks) {
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await buildQuery(idChunk).range(from, from + pageSize - 1);
      if (error) throw error;
      const pageRows = (data ?? []) as unknown as RequestRow[];
      pageRows.forEach((row) => rowsById.set(row.id, row));
      if (pageRows.length < pageSize) break;
    }
  }
  const rows = [...rowsById.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const { data: collegeRows } = await supabase.from("colleges").select("id, name");
  const collegeNameById = new Map<string, string>(
    ((collegeRows ?? []) as Array<{ id: string; name: string | null }>).map((c) => [
      c.id,
      c.name?.trim() || "College",
    ]),
  );

  const overview = buildOverview(rows, collegeNameById);
  const pendingCount = await countPendingForRole(scope as AppRole, userId ?? "", {
    collegeId,
    organizationId,
  });
  overview.totals.pendingCount = pendingCount;
  const pendingSlice = overview.eventStatusData.find((slice) => slice.name === "Pending");
  if (pendingSlice) pendingSlice.value = pendingCount;
  return overview;
}
