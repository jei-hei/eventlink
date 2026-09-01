import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { fetchAdminPortalUsers, adminRoleLabel } from "@/services/adminUsersDb";
import { fetchAllVenues } from "@/services/venuesDb";
import { fetchAllEquipment } from "@/services/equipmentDb";
import { fetchCollegesWithOrganizations } from "@/services/organizationsDb";

export type AdminReportFilters = {
  dateFrom: string;
  dateTo: string;
  collegeId: string;
  organizationId: string;
  status: string;
  requestType: string;
  role: string;
  responsibleOffice: string;
};

export type AdminReportDetailRow = {
  id: string;
  event: string;
  organization: string;
  college: string;
  requester: string;
  requesterRole: string;
  date: string;
  venue: string;
  status: string;
  requestType: string;
  organizationId: string | null;
  collegeId: string | null;
  offices: string[];
};

export type NameCount = { name: string; count: number };

export type AdminReportsData = {
  eventStats: {
    total: number;
    scheduledOrApproved: number;
    pending: number;
    declined: number;
    cancelled: number;
  };
  userStats: {
    total: number;
    active: number;
    inactive: number;
    byRole: NameCount[];
    byCollege: NameCount[];
  };
  organizationStats: {
    total: number;
    eventsByOrganization: NameCount[];
    eventsByCollege: NameCount[];
  };
  approvalStats: {
    pending: number;
    approved: number;
    declined: number;
    revision: number;
    byOffice: NameCount[];
  };
  resourceStats: {
    venues: {
      total: number;
      available: number;
      unavailable: number;
      mostRequested: NameCount[];
    };
    equipment: {
      total: number;
      available: number;
      unavailable: number;
      mostRequested: NameCount[];
    };
    requestsByOffice: NameCount[];
  };
  detailRows: AdminReportDetailRow[];
  filterOptions: {
    colleges: { id: string; name: string }[];
    organizations: { id: string; name: string; collegeId: string | null }[];
  };
};

type EventRequestQueryRow = {
  id: string;
  activity: string | null;
  status: string;
  request_type: string;
  venue: string | null;
  start_date: string | null;
  created_at: string;
  organization_id: string | null;
  submitted_by: string | null;
  current_step: string | null;
  organizations:
    | { id: string; name: string | null; college_id: string | null }
    | { id: string; name: string | null; college_id: string | null }[]
    | null;
  event_request_resource_assignments:
    | Array<{
        assigned_office: string | null;
        resource_kind: string | null;
        venue_id: string | null;
        equipment_id: string | null;
        resource_name: string | null;
        status: string | null;
      }>
    | null;
  event_request_equipment:
    | Array<{
        equipment_id: string | null;
        quantity_requested: number | null;
        equipment: { id: string; name: string | null } | { id: string; name: string | null }[] | null;
      }>
    | null;
};

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function emptyData(): AdminReportsData {
  return {
    eventStats: { total: 0, scheduledOrApproved: 0, pending: 0, declined: 0, cancelled: 0 },
    userStats: { total: 0, active: 0, inactive: 0, byRole: [], byCollege: [] },
    organizationStats: { total: 0, eventsByOrganization: [], eventsByCollege: [] },
    approvalStats: { pending: 0, approved: 0, declined: 0, revision: 0, byOffice: [] },
    resourceStats: {
      venues: { total: 0, available: 0, unavailable: 0, mostRequested: [] },
      equipment: { total: 0, available: 0, unavailable: 0, mostRequested: [] },
      requestsByOffice: [],
    },
    detailRows: [],
    filterOptions: { colleges: [], organizations: [] },
  };
}

function topCounts(map: Map<string, number>, limit = 8): NameCount[] {
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function officeLabel(office: string): string {
  if (office === "it_infrastructure") return "IT Infrastructure";
  if (office === "sports_office") return "Sports Office";
  if (office === "gso") return "GSO";
  if (office === "ssc") return "SSC";
  return office.replace(/_/g, " ");
}

function officesForRow(row: EventRequestQueryRow): string[] {
  const set = new Set<string>();
  for (const a of row.event_request_resource_assignments ?? []) {
    if (a.assigned_office) set.add(a.assigned_office);
  }
  if (row.current_step === "gso") set.add("gso");
  return [...set];
}

function matchesFilters(
  row: AdminReportDetailRow,
  raw: EventRequestQueryRow,
  filters: AdminReportFilters,
  roleByUserId: Map<string, string>,
): boolean {
  if (filters.dateFrom) {
    const d = row.date || raw.created_at.slice(0, 10);
    if (d < filters.dateFrom) return false;
  }
  if (filters.dateTo) {
    const d = row.date || raw.created_at.slice(0, 10);
    if (d > filters.dateTo) return false;
  }
  if (filters.collegeId && row.collegeId !== filters.collegeId) return false;
  if (filters.organizationId && row.organizationId !== filters.organizationId) return false;
  if (filters.status && raw.status !== filters.status) return false;
  if (filters.requestType && raw.request_type !== filters.requestType) return false;
  if (filters.role) {
    const role = raw.submitted_by ? roleByUserId.get(raw.submitted_by) : null;
    if (role !== filters.role) return false;
  }
  if (filters.responsibleOffice) {
    if (!row.offices.includes(filters.responsibleOffice)) return false;
  }
  return true;
}

/**
 * System-wide Admin Reports & Analytics bundle.
 * Event totals are always unique event_requests (never resource-assignment duplicates).
 */
export async function fetchAdminReportsData(
  filters: AdminReportFilters,
): Promise<AdminReportsData> {
  if (!isSupabaseConfigured) return emptyData();

  const supabase = getSupabase();

  // submitted_by references auth.users, not profiles — do not embed profiles via FK.
  // Requester names come from admin_list_portal_users instead.
  const eventSelectPrimary = `
    id, activity, status, request_type, venue, start_date, created_at,
    organization_id, submitted_by, current_step,
    organizations ( id, name, college_id ),
    event_request_resource_assignments (
      assigned_office, resource_kind, venue_id, equipment_id, resource_name, status
    ),
    event_request_equipment (
      equipment_id, quantity_requested,
      equipment ( id, name )
    )
  `;
  const eventSelectFallback = `
    id, activity, status, request_type, venue, start_date, created_at,
    organization_id, submitted_by, current_step,
    organizations ( id, name, college_id )
  `;

  const settled = await Promise.allSettled([
    fetchAdminPortalUsers(),
    fetchCollegesWithOrganizations(),
    fetchAllVenues(),
    fetchAllEquipment(),
    supabase
      .from("students")
      .select("student_id", { count: "exact", head: true })
      .eq("archived", true),
    supabase
      .from("event_requests")
      .select(eventSelectPrimary)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const users = settled[0].status === "fulfilled" ? settled[0].value : [];
  const collegesWithOrgs = settled[1].status === "fulfilled" ? settled[1].value : [];
  const venues = settled[2].status === "fulfilled" ? settled[2].value : [];
  const equipment = settled[3].status === "fulfilled" ? settled[3].value : [];
  const archivedStudentsRes =
    settled[4].status === "fulfilled" ? settled[4].value : { count: 0, error: null };

  let eventRes =
    settled[5].status === "fulfilled"
      ? settled[5].value
      : { data: null as null, error: { message: "event_requests query failed" } };

  if (eventRes.error) {
    const retry = await supabase
      .from("event_requests")
      .select(eventSelectFallback)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (retry.error) {
      throw new Error(
        retry.error.message ||
          eventRes.error.message ||
          "Could not load event requests for reports.",
      );
    }
    eventRes = retry;
  }

  if (settled[0].status === "rejected") {
    console.warn("Admin reports: users load failed", settled[0].reason);
  }

  const collegeNameById = new Map(
    collegesWithOrgs.map((c) => [c.id, c.name] as const),
  );
  const roleByUserId = new Map(users.map((u) => [u.user_id, u.app_role] as const));
  const displayByUserId = new Map(users.map((u) => [u.user_id, u.display_name] as const));

  const rawRows = (eventRes.data ?? []) as unknown as EventRequestQueryRow[];

  const detailAll: Array<{ detail: AdminReportDetailRow; raw: EventRequestQueryRow }> =
    rawRows.map((row) => {
      const org = asSingle(row.organizations);
      const collegeId = org?.college_id ?? null;
      const requester =
        (row.submitted_by ? displayByUserId.get(row.submitted_by) : null)?.trim() || "—";
      const requesterRole = row.submitted_by
        ? adminRoleLabel(roleByUserId.get(row.submitted_by) ?? "")
        : "—";
      const detail: AdminReportDetailRow = {
        id: row.id,
        event: row.activity?.trim() || "Untitled event",
        organization: org?.name?.trim() || "—",
        college: collegeId ? (collegeNameById.get(collegeId) ?? "—") : "—",
        requester,
        requesterRole,
        date: row.start_date || row.created_at.slice(0, 10),
        venue: row.venue?.trim() || "—",
        status: statusLabel(row.status),
        requestType: row.request_type,
        organizationId: row.organization_id,
        collegeId,
        offices: officesForRow(row),
      };
      return { detail, raw: row };
    });

  const filtered = detailAll.filter(({ detail, raw }) =>
    matchesFilters(detail, raw, filters, roleByUserId),
  );
  const filteredRaw = filtered.map((x) => x.raw);
  const detailRows = filtered.map((x) => x.detail);

  // --- Event statistics (unique events only) ---
  let scheduledOrApproved = 0;
  let pending = 0;
  let declined = 0;
  let cancelled = 0;
  let revision = 0;
  const orgEventMap = new Map<string, number>();
  const collegeEventMap = new Map<string, number>();
  const venueRequestMap = new Map<string, number>();
  const equipmentRequestMap = new Map<string, number>();
  const officeEventMap = new Map<string, number>();
  const officeHandledMap = new Map<string, number>();

  for (const row of filteredRaw) {
    if (row.status === "approved" || row.status === "posted") scheduledOrApproved += 1;
    else if (row.status === "pending") pending += 1;
    else if (row.status === "declined") declined += 1;
    else if (row.status === "cancelled") cancelled += 1;
    else if (row.status === "revision_requested") revision += 1;

    const org = asSingle(row.organizations);
    const orgName = org?.name?.trim() || "Unassigned";
    orgEventMap.set(orgName, (orgEventMap.get(orgName) ?? 0) + 1);
    const collegeId = org?.college_id ?? null;
    const collegeName = collegeId
      ? (collegeNameById.get(collegeId) ?? "Unassigned")
      : "Unassigned";
    collegeEventMap.set(collegeName, (collegeEventMap.get(collegeName) ?? 0) + 1);

    const venueName = row.venue?.trim();
    if (venueName) {
      venueRequestMap.set(venueName, (venueRequestMap.get(venueName) ?? 0) + 1);
    }

    // Most requested equipment: count unique events that requested each item (not qty duplicates).
    const seenEq = new Set<string>();
    for (const eq of row.event_request_equipment ?? []) {
      const eqRow = asSingle(eq.equipment);
      const key = eqRow?.name?.trim() || eq.equipment_id || "";
      if (!key || seenEq.has(key)) continue;
      seenEq.add(key);
      equipmentRequestMap.set(key, (equipmentRequestMap.get(key) ?? 0) + 1);
    }

    // Resource requests by office: unique event per office
    const offices = officesForRow(row);
    for (const office of offices) {
      officeEventMap.set(office, (officeEventMap.get(office) ?? 0) + 1);
    }

    // Handled = assignment approved (or legacy declined/approved) — still unique event per office
    const handledOffices = new Set<string>();
    for (const a of row.event_request_resource_assignments ?? []) {
      if (!a.assigned_office) continue;
      if (a.status === "approved" || a.status === "declined") {
        handledOffices.add(a.assigned_office);
      }
    }
    for (const office of handledOffices) {
      officeHandledMap.set(office, (officeHandledMap.get(office) ?? 0) + 1);
    }
  }

  // Ensure GSO / IT / Sports / SSC appear even at 0
  for (const office of ["gso", "it_infrastructure", "sports_office", "ssc"]) {
    if (!officeEventMap.has(office)) officeEventMap.set(office, 0);
    if (!officeHandledMap.has(office)) officeHandledMap.set(office, 0);
  }

  // --- User statistics ---
  const roleMap = new Map<string, number>();
  const userCollegeMap = new Map<string, number>();
  for (const u of users) {
    const role = adminRoleLabel(u.app_role);
    roleMap.set(role, (roleMap.get(role) ?? 0) + 1);
    const college = u.college?.trim() && u.college !== "—" ? u.college.trim() : "Unassigned";
    userCollegeMap.set(college, (userCollegeMap.get(college) ?? 0) + 1);
  }

  const inactiveStudents = archivedStudentsRes.count ?? 0;
  const totalUsers = users.length;
  // Portal accounts are treated as active; archived registry students = inactive pool.
  const activeUsers = totalUsers;
  const inactiveUsers = inactiveStudents;

  const venueAvailable = venues.filter(
    (v) => v.active && v.availability !== "unavailable" && v.status !== "inactive",
  ).length;
  const venueUnavailable = venues.length - venueAvailable;
  const eqAvailable = equipment.filter(
    (e) => e.active && e.availability !== "unavailable" && e.status !== "inactive",
  ).length;
  const eqUnavailable = equipment.length - eqAvailable;

  const organizations = collegesWithOrgs.flatMap((c) =>
    c.organizations.map((o) => ({ id: o.id, name: o.name, collegeId: c.id as string | null })),
  );

  return {
    eventStats: {
      total: filteredRaw.length,
      scheduledOrApproved,
      pending,
      declined,
      cancelled,
    },
    userStats: {
      total: totalUsers,
      active: activeUsers,
      inactive: inactiveUsers,
      byRole: topCounts(roleMap, 20),
      byCollege: topCounts(userCollegeMap, 20),
    },
    organizationStats: {
      total: organizations.length,
      eventsByOrganization: topCounts(orgEventMap),
      eventsByCollege: topCounts(collegeEventMap),
    },
    approvalStats: {
      pending,
      approved: scheduledOrApproved,
      declined,
      revision,
      byOffice: Array.from(officeHandledMap.entries())
        .map(([name, count]) => ({ name: officeLabel(name), count }))
        .sort((a, b) => b.count - a.count),
    },
    resourceStats: {
      venues: {
        total: venues.length,
        available: venueAvailable,
        unavailable: venueUnavailable,
        mostRequested: topCounts(venueRequestMap),
      },
      equipment: {
        total: equipment.length,
        available: eqAvailable,
        unavailable: eqUnavailable,
        mostRequested: topCounts(equipmentRequestMap),
      },
      requestsByOffice: Array.from(officeEventMap.entries())
        .map(([name, count]) => ({ name: officeLabel(name), count }))
        .sort((a, b) => b.count - a.count),
    },
    detailRows,
    filterOptions: {
      colleges: collegesWithOrgs.map((c) => ({ id: c.id, name: c.name })),
      organizations,
    },
  };
}

export function defaultAdminReportFilters(): AdminReportFilters {
  return {
    dateFrom: "",
    dateTo: "",
    collegeId: "",
    organizationId: "",
    status: "",
    requestType: "",
    role: "",
    responsibleOffice: "",
  };
}
