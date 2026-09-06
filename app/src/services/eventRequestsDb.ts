import { getSupabase } from "@/lib/supabase";
import { uploadEventLetter } from "@/services/eventLetterStorage";
import { getEventPostImagePublicUrl, uploadEventPostImage } from "@/services/eventPostImageStorage";
import { sendNotificationEmail } from "@/services/notificationEmail";
import type { PublishStudentPostInput } from "@/types/studentPost";
import type { AppRole } from "@/types/appRole";
import type {
  CreateEventRequestInput,
  EventRequestHistoryRow,
  EventRequestRow,
} from "@/types/eventRequest";
import type { PortalEvent } from "@/types/portalEvent";
import {
  appRoleToResourceOffice,
  buildWorkflowHistory,
  getInitialStep,
  getNextStep,
  roleMatchesStep,
  stepLabel,
  workflowStatusForResourceOffices,
  workflowStatusForStep,
} from "@/services/eventRequestWorkflow";
import type { DbWorkflowStep } from "@/types/eventRequest";
import type { ResourceAssignmentInput, ResourceOffice } from "@/types/resourceOffice";
import {
  EQUIPMENT_OFFICES,
  VENUE_OFFICES,
  isResourceOffice,
  resourceOfficeLabel,
} from "@/types/resourceOffice";

function formatTime(t: string): string {
  if (!t) return "";
  const parts = t.split(":");
  if (parts.length < 2) return t;
  let h = parseInt(parts[0] ?? "0", 10);
  const m = parts[1] ?? "00";
  const am = h < 12;
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${am ? "AM" : "PM"}`;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateRange(start: string, end: string): string {
  if (start === end) return formatShortDate(start);
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

function formatEventScheduleSnippet(row: {
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  venue: string;
}): string {
  const when = formatDateRange(row.start_date, row.end_date);
  const time = [formatTime(row.start_time), formatTime(row.end_time)].filter(Boolean).join(" – ");
  const venue = row.venue?.trim() || "TBA";
  return `${when}${time ? ` · ${time}` : ""} · ${venue}`;
}

type NotificationPayload = {
  userId: string;
  title: string;
  body: string;
  category: "approval" | "calendar" | "system" | "security" | "other";
  emailSubject?: string;
  emailText?: string;
};

async function notifyUser(payload: NotificationPayload): Promise<void> {
  const supabase = getSupabase();
  const { error: insertErr } = await supabase.from("notifications").insert({
    user_id: payload.userId,
    title: payload.title,
    body: payload.body,
    category: payload.category,
  });
  if (insertErr) return;

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("email, notify_email")
    .eq("id", payload.userId)
    .maybeSingle();
  if (profileErr) return;
  const canEmail = (profile?.notify_email ?? true) && !!profile?.email && String(profile.email).includes("@");
  if (!canEmail) return;

  const subject = payload.emailSubject ?? payload.title;
  const text = payload.emailText ?? payload.body;
  try {
    await sendNotificationEmail({
      to: String(profile?.email ?? ""),
      subject,
      text,
    });
  } catch {
    // best effort only; in-app notification is primary channel
  }
}

async function notifyUsersWithRole(
  role: ResourceOffice,
  payload: Omit<NotificationPayload, "userId">,
): Promise<void> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("user_roles").select("user_id").eq("role", role);
  if (error || !data?.length) return;
  const uniqueIds = [...new Set(data.map((r) => r.user_id).filter(Boolean))];
  await Promise.all(uniqueIds.map((userId) => notifyUser({ ...payload, userId })));
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    eo: "Executive Officer",
    osas: "OSAS",
    adviser: "Adviser",
    dean: "Dean",
    admin: "Admin",
    gso: "GSO",
    it_infrastructure: "IT Infrastructure",
    sports_office: "Sports Office",
    ssc: "SSC",
    student_officer: "Student Officer",
  };
  return map[role] ?? role;
}

function mapStatus(row: EventRequestRow): PortalEvent["status"] {
  if (row.status === "cancelled") return "Cancelled";
  if (row.status === "declined" || row.status === "revision_requested") return "Pending";
  if (row.status === "posted") return "Approved";
  if (row.status === "approved" && row.current_step === "eo_publish") return "Pending";
  if (row.status === "approved") return "Approved";
  return "Pending";
}

function equipmentSummary(row: EventRequestRow): string {
  const lines = row.event_request_equipment ?? [];
  if (!lines.length) return "";
  return lines
    .map((line) => {
      const name = line.equipment?.name?.trim() || "Equipment";
      const qty = Number(line.quantity_requested ?? 0);
      return `${name} (x${qty > 0 ? qty : 1})`;
    })
    .join(", ");
}

function extractCollegeTag(purpose: string | null | undefined): { college: string | null; cleanPurpose: string } {
  const raw = (purpose ?? "").trim();
  const m = raw.match(/^\[COLLEGE:(.+?)\]\s*(.*)$/i);
  if (!m) return { college: null, cleanPurpose: raw };
  return {
    college: (m[1] ?? "").trim() || null,
    cleanPurpose: (m[2] ?? "").trim(),
  };
}

export function mapRowToPortalEvent(
  row: EventRequestRow,
  history: EventRequestHistoryRow[] = [],
): PortalEvent {
  const parsedPurpose = extractCollegeTag(row.purpose);
  const orgName = row.organizations?.name ?? parsedPurpose.college ?? "Organization";
  const submitter = row.profiles?.display_name ?? "Requester";
  const approvals = history
    .filter((h) => h.action === "approved" && h.step)
    .map((h) => ({
      step: h.step as DbWorkflowStep,
      approver: h.profiles?.display_name ?? "Staff",
      at: new Date(h.created_at).toLocaleString(),
    }));

  const pendingOffices = (row.event_request_resource_assignments ?? [])
    .filter((a) => a.status === "pending")
    .map((a) => a.assigned_office as ResourceOffice);

  const wfStatus =
    row.status === "cancelled"
      ? "Cancelled"
      : row.status === "revision_requested"
        ? "Revision Requested"
      : row.status === "declined"
      ? "Rejected"
      : row.status === "posted" || (row.status === "approved" && row.calendar_posted_at)
        ? "Approved"
        : row.current_step === "resource_offices"
          ? (workflowStatusForResourceOffices(pendingOffices) as PortalEvent["workflowStatus"])
          : row.current_step === "eo_publish"
            ? "Pending EO"
            : row.current_step === "eo_schedule"
              ? "Pending EO Review"
              : row.status === "approved"
                ? "Approved"
                : (workflowStatusForStep(row.current_step) as PortalEvent["workflowStatus"]);

  return {
    id: row.id,
    name: row.activity,
    activity: row.activity,
    date: formatDateRange(row.start_date, row.end_date),
    startDate: row.start_date,
    endDate: row.end_date,
    venue: row.venue,
    venueId: row.venue_id ?? null,
    status: mapStatus(row),
    workflowStatus: wfStatus,
    organization: orgName,
    eventType: row.request_type === "ssc" ? "SSC Event" : "Student Event",
    description: parsedPurpose.cleanPurpose,
    purpose: parsedPurpose.cleanPurpose,
    itemsEquipment: equipmentSummary(row),
    equipmentLines: (row.event_request_equipment ?? []).map((line) => ({
      equipmentId: line.equipment?.id ?? "",
      name: line.equipment?.name?.trim() || "Equipment",
      quantity: Math.max(1, Number(line.quantity_requested ?? 1)),
    })),
    startTime: formatTime(row.start_time),
    endTime: formatTime(row.end_time),
    participants: row.number_of_participants,
    sdgs: row.sdgs,
    requesterName: submitter,
    needsGSO: row.needs_gso,
    posted: row.status === "posted",
    calendarPosted: row.calendar_posted_at != null && row.status !== "cancelled",
    awaitingPublish: row.current_step === "eo_publish" && row.status !== "posted",
    awaitingCalendarPost: row.current_step === "eo_publish" && !row.calendar_posted_at,
    awaitingResourceAssignment: row.current_step === "eo_schedule" && row.status === "pending",
    resourceAssignments: (row.event_request_resource_assignments ?? []).map((a) => ({
      id: a.id,
      resourceKind: a.resource_kind,
      venueId: a.venue_id,
      equipmentId: a.equipment_id,
      resourceName: a.resource_name,
      quantity: a.quantity,
      assignedOffice: a.assigned_office as ResourceOffice,
      status: a.status,
      declineReason: a.decline_reason,
    })),
    declineReason: row.decline_reason ?? undefined,
    cancellationReason: row.cancellation_reason ?? undefined,
    cancelledAt: row.cancelled_at ?? null,
    letterPath: row.letter_path,
    originalLetterPath: row.original_letter_path ?? row.letter_path ?? null,
    letterHistory: (row.event_request_letters ?? [])
      .slice()
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((l, idx, arr) => ({
        id: l.id,
        letterPath: l.letter_path,
        label: l.label || (idx === arr.length - 1 ? `Version ${arr.length - idx}` : `Version ${arr.length - idx}`),
        createdAt: l.created_at,
      })),
    complianceComments: (row.event_request_compliance_comments ?? [])
      .slice()
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((c) => ({
        id: c.id,
        comment: c.comment,
        attachmentPath: c.attachment_path,
        attachmentName: c.attachment_name,
        senderId: c.sender_id,
        senderRole: c.sender_role,
        senderName: c.profiles?.display_name ?? roleLabel(c.sender_role),
        createdAt: c.created_at,
      })),
    studentPostCaption: row.student_post_caption,
    updatedAt: row.updated_at ?? null,
    studentPostImagePath: row.student_post_image_path,
    studentPostImageUrl: row.student_post_image_path
      ? getEventPostImagePublicUrl(row.student_post_image_path)
      : null,
    postedAt: row.posted_at,
    workflowHistory: buildWorkflowHistory(
      row.request_type,
      row.current_step,
      row.needs_gso,
      approvals,
    ),
  };
}

/** Posted events only — for the public /student dashboard (works with anon + auth). */
export async function fetchPostedEventRequests(): Promise<EventRequestRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("event_requests")
    .select(
      `
      *,
      organizations ( id, name, college_id ),
      event_request_equipment ( quantity_requested, equipment ( id, name ) )
    `,
    )
    .eq("status", "posted")
    .order("start_date", { ascending: true });

  if (error) {
    const fallback = await supabase
      .from("event_requests")
      .select(`*, organizations ( id, name, college_id ), event_request_equipment ( quantity_requested, equipment ( id, name ) )`)
      .eq("status", "posted")
      .order("start_date", { ascending: true });
    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []) as EventRequestRow[];
  }
  return (data ?? []) as EventRequestRow[];
}

const EVENT_REQUEST_LIST_SELECT = `
  id, request_type, status, current_step, organization_id, submitted_by,
  activity, start_date, end_date, start_time, end_time, venue, venue_id,
  number_of_participants, sdgs, purpose, needs_gso,
  letter_path, original_letter_path, decline_reason, declined_at_step,
  cancellation_reason, cancelled_at, cancelled_by,
  posted_at, calendar_posted_at, student_post_caption, student_post_image_path,
  created_at, updated_at,
  organizations ( id, name, college_id ),
  profiles!event_requests_submitted_by_fkey ( display_name ),
  event_request_equipment ( quantity_requested, equipment ( id, name ) ),
  event_request_resource_assignments (
    id, resource_kind, venue_id, equipment_id, resource_name, quantity,
    assigned_office, status, decline_reason
  )
`;

const EVENT_REQUEST_LIST_SELECT_INNER_ORG = `
  id, request_type, status, current_step, organization_id, submitted_by,
  activity, start_date, end_date, start_time, end_time, venue, venue_id,
  number_of_participants, sdgs, purpose, needs_gso,
  letter_path, original_letter_path, decline_reason, declined_at_step,
  cancellation_reason, cancelled_at, cancelled_by,
  posted_at, calendar_posted_at, student_post_caption, student_post_image_path,
  created_at, updated_at,
  organizations!inner ( id, name, college_id ),
  profiles!event_requests_submitted_by_fkey ( display_name ),
  event_request_equipment ( quantity_requested, equipment ( id, name ) ),
  event_request_resource_assignments (
    id, resource_kind, venue_id, equipment_id, resource_name, quantity,
    assigned_office, status, decline_reason
  )
`;

const EVENT_REQUEST_LIST_FALLBACK_SELECT = `
  id, request_type, status, current_step, organization_id, submitted_by,
  activity, start_date, end_date, start_time, end_time, venue, venue_id,
  number_of_participants, sdgs, purpose, needs_gso,
  letter_path, original_letter_path, decline_reason, declined_at_step,
  cancellation_reason, cancelled_at, cancelled_by,
  posted_at, calendar_posted_at, student_post_caption, student_post_image_path,
  created_at, updated_at,
  organizations ( id, name, college_id ),
  event_request_equipment ( quantity_requested, equipment ( id, name ) ),
  event_request_resource_assignments (
    id, resource_kind, venue_id, equipment_id, resource_name, quantity,
    assigned_office, status, decline_reason
  )
`;

const EVENT_REQUEST_LIST_BARE_SELECT = `
  id, request_type, status, current_step, organization_id, submitted_by,
  activity, start_date, end_date, start_time, end_time, venue, venue_id,
  number_of_participants, sdgs, purpose, needs_gso,
  letter_path, original_letter_path, decline_reason, declined_at_step,
  cancellation_reason, cancelled_at, cancelled_by,
  posted_at, calendar_posted_at, student_post_caption, student_post_image_path,
  created_at, updated_at,
  organizations ( id, name, college_id ),
  event_request_equipment ( quantity_requested, equipment ( id, name ) )
`;

const PORTAL_LIST_LIMIT = 100;

const ASSIGNMENT_LIST_SELECT =
  "id, request_id, resource_kind, venue_id, equipment_id, resource_name, quantity, assigned_office, status, decline_reason";

type AssignmentListRow = NonNullable<EventRequestRow["event_request_resource_assignments"]>[number] & {
  request_id: string;
};

/** Fill assignments only when the nested embed was missing (not when it is an empty array). */
async function attachResourceAssignments(rows: EventRequestRow[]): Promise<EventRequestRow[]> {
  if (!rows.length) return rows;
  const missing = rows.filter((r) => r.event_request_resource_assignments == null);
  const targetIds = [...new Set(missing.map((r) => r.id))];
  if (!targetIds.length) return rows;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("event_request_resource_assignments")
    .select(ASSIGNMENT_LIST_SELECT)
    .in("request_id", targetIds);
  if (error || !data) return rows;

  const byRequest = new Map<string, NonNullable<EventRequestRow["event_request_resource_assignments"]>>();
  for (const row of data as AssignmentListRow[]) {
    const list = byRequest.get(row.request_id) ?? [];
    list.push({
      id: row.id,
      resource_kind: row.resource_kind,
      venue_id: row.venue_id,
      equipment_id: row.equipment_id,
      resource_name: row.resource_name,
      quantity: row.quantity,
      assigned_office: row.assigned_office,
      status: row.status,
      decline_reason: row.decline_reason,
    });
    byRequest.set(row.request_id, list);
  }

  return rows.map((r) => {
    if (!targetIds.includes(r.id)) return r;
    return {
      ...r,
      event_request_resource_assignments: byRequest.get(r.id) ?? [],
    };
  });
}

export type PortalEventLoadScope = {
  role: AppRole;
  userId: string;
  collegeId?: string | null;
  organizationId?: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runEventRequestListQuery(select: string, apply: (q: any) => any): Promise<EventRequestRow[]> {
  const supabase = getSupabase();
  const base = supabase
    .from("event_requests")
    .select(select)
    .order("created_at", { ascending: false })
    .limit(PORTAL_LIST_LIMIT);
  const { data, error } = await apply(base);
  let rows: EventRequestRow[];
  if (error) {
    const fallbackBase = supabase
      .from("event_requests")
      .select(EVENT_REQUEST_LIST_FALLBACK_SELECT)
      .order("created_at", { ascending: false })
      .limit(PORTAL_LIST_LIMIT);
    const fallback = await apply(fallbackBase);
    if (fallback.error) {
      const bareBase = supabase
        .from("event_requests")
        .select(EVENT_REQUEST_LIST_BARE_SELECT)
        .order("created_at", { ascending: false })
        .limit(PORTAL_LIST_LIMIT);
      const bare = await apply(bareBase);
      if (bare.error) throw bare.error;
      rows = (bare.data ?? []) as EventRequestRow[];
    } else {
      rows = (fallback.data ?? []) as EventRequestRow[];
    }
  } else {
    rows = (data ?? []) as EventRequestRow[];
  }
  return attachResourceAssignments(rows);
}

/** Role-scoped fetch — avoids loading the full event_requests table on every portal view. */
export async function fetchPortalEventRequestsForRole(
  scope: PortalEventLoadScope,
): Promise<EventRequestRow[]> {
  const { role, userId, collegeId, organizationId } = scope;

  switch (role) {
    case "student_officer": {
      if (organizationId) {
        return runEventRequestListQuery(EVENT_REQUEST_LIST_SELECT, (q) =>
          q.eq("request_type", "student_officer").eq("organization_id", organizationId),
        );
      }
      return runEventRequestListQuery(EVENT_REQUEST_LIST_SELECT, (q) =>
        q.eq("request_type", "student_officer").eq("submitted_by", userId),
      );
    }
    case "ssc":
      return runEventRequestListQuery(EVENT_REQUEST_LIST_SELECT, (q) =>
        q.or(
          "request_type.eq.ssc,and(status.eq.pending,current_step.eq.resource_offices),calendar_posted_at.not.is.null",
        ),
      );
    case "adviser": {
      if (!organizationId) return [];
      return runEventRequestListQuery(EVENT_REQUEST_LIST_SELECT, (q) =>
        q.eq("organization_id", organizationId),
      );
    }
    case "dean": {
      if (!collegeId) return [];
      return runEventRequestListQuery(EVENT_REQUEST_LIST_SELECT_INNER_ORG, (q) =>
        q.eq("organizations.college_id", collegeId),
      );
    }
    case "gso":
    case "it_infrastructure":
    case "sports_office":
      return runEventRequestListQuery(EVENT_REQUEST_LIST_SELECT, (q) =>
        q.or(
          "and(status.eq.pending,current_step.in.(gso,resource_offices)),calendar_posted_at.not.is.null",
        ),
      );
    case "osas":
      return runEventRequestListQuery(EVENT_REQUEST_LIST_SELECT, (q) =>
        q.or(
          "and(status.eq.pending,current_step.in.(osas,eo_schedule,eo_publish,resource_offices)),status.in.(declined,cancelled,revision_requested),calendar_posted_at.not.is.null",
        ),
      );
    case "eo":
      return runEventRequestListQuery(EVENT_REQUEST_LIST_SELECT, (q) =>
        q.or(
          "and(status.eq.pending,current_step.in.(eo_schedule,eo_publish,resource_offices)),status.in.(cancelled,revision_requested),calendar_posted_at.not.is.null",
        ),
      );
    case "infirmary":
    case "nstp":
      return runEventRequestListQuery(EVENT_REQUEST_LIST_SELECT, (q) =>
        q.or(
          "status.in.(posted,cancelled),and(status.eq.approved,calendar_posted_at.not.is.null)",
        ),
      );
    default:
      return fetchAllEventRequests();
  }
}

/** Lazy-load document history + compliance comments for a single request (detail views). */
export async function fetchEventRequestDocuments(requestId: string): Promise<{
  letters: NonNullable<EventRequestRow["event_request_letters"]>;
  comments: NonNullable<EventRequestRow["event_request_compliance_comments"]>;
}> {
  const supabase = getSupabase();
  const [lettersRes, commentsRes] = await Promise.all([
    supabase
      .from("event_request_letters")
      .select("id, letter_path, label, created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false }),
    supabase
      .from("event_request_compliance_comments")
      .select("id, comment, attachment_path, attachment_name, sender_id, sender_role, created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false }),
  ]);
  return {
    letters: (lettersRes.data ?? []) as NonNullable<EventRequestRow["event_request_letters"]>,
    comments: (commentsRes.data ?? []) as NonNullable<EventRequestRow["event_request_compliance_comments"]>,
  };
}

export async function fetchAllEventRequests(): Promise<EventRequestRow[]> {
  return runEventRequestListQuery(EVENT_REQUEST_LIST_SELECT, (q) => q);
}

export async function fetchHistoryForRequest(requestId: string): Promise<EventRequestHistoryRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("event_request_history")
    .select(`*, profiles ( display_name )`)
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EventRequestHistoryRow[];
}

export async function checkVenueAvailable(
  venue: string,
  startDate: string,
  endDate: string,
  excludeId?: string,
  startTime?: string,
  endTime?: string,
): Promise<boolean> {
  const supabase = getSupabase();
  const payload: Record<string, unknown> = {
    p_venue: venue,
    p_start: startDate,
    p_end: endDate,
    p_exclude_id: excludeId ?? null,
  };
  if (startTime && endTime) {
    payload.p_start_time = startTime.length === 5 ? `${startTime}:00` : startTime;
    payload.p_end_time = endTime.length === 5 ? `${endTime}:00` : endTime;
  }
  const { data, error } = await supabase.rpc("check_venue_availability", payload);
  if (error) throw error;
  return Boolean(data);
}

export async function createEventRequest(
  input: CreateEventRequestInput,
  submittedBy: string,
): Promise<string> {
  const { assertRateLimitAllowed } = await import("@/services/rateLimitDb");
  await assertRateLimitAllowed("event_submit");

  if (
    (input.requestType === "student_officer" || input.requestType === "ssc") &&
    !input.letterFile
  ) {
    throw new Error("Please upload your PDF proposal (.pdf).");
  }

  const available = await checkVenueAvailable(
    input.venue,
    input.startDate,
    input.endDate,
    undefined,
    input.startTime,
    input.endTime,
  );
  if (!available) {
    throw new Error(
      "This venue is already booked for an overlapping date and time. Choose a different time or venue.",
    );
  }

  const initialStep = getInitialStep(input.requestType);
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("event_requests")
    .insert({
      request_type: input.requestType,
      status: input.requestType === "eo_direct" ? "posted" : "pending",
      current_step: input.requestType === "eo_direct" ? null : initialStep,
      organization_id: input.organizationId ?? null,
      submitted_by: submittedBy,
      activity: input.activity.trim(),
      start_date: input.startDate,
      end_date: input.endDate,
      start_time: input.startTime,
      end_time: input.endTime,
      venue: input.venue.trim(),
      venue_id: input.venueId ?? null,
      number_of_participants: input.numberOfParticipants,
      sdgs: input.sdgs?.trim() ?? "",
      purpose: input.purpose?.trim() ?? "",
      needs_gso: input.needsGso,
      posted_at: input.requestType === "eo_direct" ? new Date().toISOString() : null,
      calendar_posted_at: input.requestType === "eo_direct" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.message.toLowerCase().includes("row-level security")) {
      throw new Error(
        "Permission denied. Sign in as Student Officer or SSC (officer@eventlink.local / ssc@eventlink.local). " +
          "If you already use those accounts, run the latest SQL in supabase/migrations/20260528200000_fix_event_requests_rls.sql in the Supabase SQL Editor.",
      );
    }
    throw error;
  }

  const requestId = data.id as string;

  if (input.letterFile) {
    try {
      const letterPath = await uploadEventLetter(input.letterFile, submittedBy, requestId);
      const { error: letterErr } = await supabase
        .from("event_requests")
        .update({ letter_path: letterPath, original_letter_path: letterPath })
        .eq("id", requestId);
      if (letterErr) throw letterErr;
      await supabase.from("event_request_letters").insert({
        request_id: requestId,
        letter_path: letterPath,
        label: "Version 1 — Original Proposal",
        created_by: submittedBy,
      });
    } catch (letterErr) {
      const msg = letterErr instanceof Error ? letterErr.message : String(letterErr);
      if (msg.toLowerCase().includes("row-level security") || msg.toLowerCase().includes("policy")) {
        throw new Error(
          "Event was created but the PDF proposal could not be saved. Run supabase/migrations/20260528120000_event_letters_storage.sql and 20260528200000_fix_event_requests_rls.sql in the Supabase SQL Editor, then try again.",
        );
      }
      throw letterErr;
    }
  }

  if (input.equipment?.length) {
    const eqIds = input.equipment.map((e) => e.equipmentId);
    const { data: stockRows, error: stockErr } = await supabase
      .from("equipment")
      .select("id, name, quantity_available")
      .in("id", eqIds);
    if (stockErr) throw stockErr;
    const stockById = new Map(
      (stockRows ?? []).map((r) => [String(r.id), r as { id: string; name: string; quantity_available: number }]),
    );
    for (const line of input.equipment) {
      const stock = stockById.get(line.equipmentId);
      const available = Math.max(0, Number(stock?.quantity_available ?? 0));
      if (available <= 0) {
        throw new Error(
          `This equipment is currently unavailable${stock?.name ? `: ${stock.name}` : ""}.`,
        );
      }
      if (line.quantity > available) {
        throw new Error(
          `Requested quantity for ${stock?.name ?? "equipment"} exceeds available stock (${available}).`,
        );
      }
    }
    const { error: eqErr } = await supabase.from("event_request_equipment").insert(
      input.equipment.map((e) => ({
        request_id: requestId,
        equipment_id: e.equipmentId,
        quantity_requested: e.quantity,
      })),
    );
    if (eqErr) throw eqErr;
  }

  await supabase.from("event_request_history").insert({
    request_id: requestId,
    actor_id: submittedBy,
    action: "submitted",
    step: initialStep,
    comment: "Event request submitted",
  });

  await notifyUser({
    userId: submittedBy,
    title: "Request submitted",
    body: `"${input.activity.trim()}" was submitted (${formatEventScheduleSnippet({
      start_date: input.startDate,
      end_date: input.endDate,
      start_time: input.startTime,
      end_time: input.endTime,
      venue: input.venue,
    })}). Awaiting ${stepLabel(initialStep)}.`,
    category: "approval",
    emailSubject: "EventLink: Request submitted",
    emailText: `Your event request "${input.activity.trim()}" was submitted successfully.\nSchedule: ${formatEventScheduleSnippet({
      start_date: input.startDate,
      end_date: input.endDate,
      start_time: input.startTime,
      end_time: input.endTime,
      venue: input.venue,
    })}\nNext: ${stepLabel(initialStep)}.`,
  });

  return requestId;
}

async function getRow(id: string): Promise<EventRequestRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("event_requests")
    .select(
      `*, organizations ( id, name, college_id ), event_request_equipment ( quantity_requested, equipment ( id, name ) ), event_request_resource_assignments ( id, resource_kind, venue_id, equipment_id, resource_name, quantity, assigned_office, status, decline_reason )`,
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as EventRequestRow;
}

async function assertActorCanHandleCurrentStep(
  row: EventRequestRow,
  actorId: string,
  actorRole: AppRole,
): Promise<void> {
  if (!row.current_step || !roleMatchesStep(actorRole, row.current_step)) {
    throw new Error(`This request is not awaiting ${stepLabel(row.current_step)}.`);
  }
  if (actorRole !== "adviser" && actorRole !== "dean") return;

  const supabase = getSupabase();
  const { data: actorProfile, error: actorErr } = await supabase
    .from("profiles")
    .select("college_id, organization_id")
    .eq("id", actorId)
    .maybeSingle();
  if (actorErr) throw actorErr;

  if (actorRole === "adviser") {
    if (!actorProfile?.organization_id || actorProfile.organization_id !== row.organization_id) {
      throw new Error("This request is assigned to a different organization adviser.");
    }
    return;
  }

  const requestCollegeId = row.organizations?.college_id ?? null;
  if (!actorProfile?.college_id || !requestCollegeId || actorProfile.college_id !== requestCollegeId) {
    throw new Error("This request is assigned to a different college dean.");
  }
}

async function decrementEquipmentForRequest(row: EventRequestRow): Promise<void> {
  const lines = row.event_request_equipment ?? [];
  if (!lines.length) return;
  const supabase = getSupabase();

  for (const line of lines) {
    const equipmentId = line.equipment?.id;
    if (!equipmentId) continue;
    const qty = Math.max(0, Number(line.quantity_requested ?? 0));
    if (qty <= 0) continue;

    const { data: eqRow, error: eqFetchError } = await supabase
      .from("equipment")
      .select("id, quantity_available")
      .eq("id", equipmentId)
      .single();
    if (eqFetchError) throw eqFetchError;

    const current = Math.max(0, Number(eqRow.quantity_available ?? 0));
    const next = Math.max(0, current - qty);
    const { error: eqUpdateError } = await supabase
      .from("equipment")
      .update({ quantity_available: next })
      .eq("id", equipmentId);
    if (eqUpdateError) throw eqUpdateError;
  }
}

export async function fetchDefaultOrganizationId(): Promise<string | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("organizations").select("id").limit(1).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function approveEventRequest(
  id: string,
  actorId: string,
  actorRole: AppRole,
): Promise<void> {
  const row = await getRow(id);
  if (row.current_step === "eo_publish") {
    throw new Error("Use Post to calendar (EO) or Post to students (organization) for this step.");
  }
  if (row.current_step === "eo_schedule" && actorRole === "eo") {
    throw new Error("Use Approve & Forward to assign resources to responsible offices.");
  }
  if (row.current_step === "resource_offices") {
    throw new Error("Use resource-office approval for assigned resources.");
  }
  if (row.status !== "pending") {
    throw new Error("Only pending requests can be approved.");
  }
  await assertActorCanHandleCurrentStep(row, actorId, actorRole);

  const next = getNextStep(row.request_type, row.current_step, row.needs_gso);
  const supabase = getSupabase();

  if (actorRole === "gso" && row.current_step === "gso") {
    await decrementEquipmentForRequest(row);
  }

  const patch: Partial<EventRequestRow> = {
    current_step: next,
  };
  if (!next) {
    patch.status = "approved";
  }

  const { error } = await supabase.from("event_requests").update(patch).eq("id", id);
  if (error) throw error;

  await supabase.from("event_request_history").insert({
    request_id: id,
    actor_id: actorId,
    action: "approved",
    step: row.current_step,
    comment: `Approved at ${stepLabel(row.current_step)}`,
  });

  const nextLabel = next ? stepLabel(next) : "final processing";
  const schedule = formatEventScheduleSnippet(row);
  await notifyUser({
    userId: row.submitted_by,
    title: "Request approved",
    body: `"${row.activity}" was approved at ${stepLabel(row.current_step)}. Next: ${nextLabel}. Scheduled: ${schedule}.`,
    category: "approval",
    emailSubject: "EventLink: Request approved",
    emailText: `Your request "${row.activity}" was approved at ${stepLabel(row.current_step)}.\nSchedule: ${schedule}\nNext step: ${nextLabel}.`,
  });
}

/**
 * EO assigns each requested resource to one or more responsible offices and forwards.
 * Does not schedule — resource offices complete the workflow.
 */
export async function approveAndForwardEventRequest(
  id: string,
  actorId: string,
  assignments: ResourceAssignmentInput[],
): Promise<void> {
  const { assertRateLimitAllowed } = await import("@/services/rateLimitDb");
  await assertRateLimitAllowed("event_mutate", id);  const row = await getRow(id);
  if (row.status !== "pending" || row.current_step !== "eo_schedule") {
    throw new Error("Only requests pending EO review can be forwarded to resource offices.");
  }
  if (!assignments.length) {
    throw new Error("Assign a responsible office to every requested resource before forwarding.");
  }

  const venueAssignments = assignments.filter((a) => a.resourceKind === "venue");
  const equipmentAssignments = assignments.filter((a) => a.resourceKind === "equipment");
  const venueOffices = [...new Set(venueAssignments.map((a) => a.assignedOffice))];
  const equipmentOffices = [...new Set(equipmentAssignments.map((a) => a.assignedOffice))];

  if (!venueAssignments.length || !venueOffices.length) {
    throw new Error("Select at least one venue responsible office before forwarding.");
  }
  for (const office of venueOffices) {
    if (!VENUE_OFFICES.includes(office) || !isResourceOffice(office)) {
      throw new Error(`Invalid venue office: ${office}`);
    }
  }
  for (const office of equipmentOffices) {
    if (!EQUIPMENT_OFFICES.includes(office) || !isResourceOffice(office)) {
      throw new Error(`Invalid resource office: ${office}`);
    }
  }

  const hasRequestedEquipment =
    (row.event_request_equipment?.length ?? 0) > 0 || equipmentAssignments.length > 0;

  if (hasRequestedEquipment && !equipmentOffices.length) {
    throw new Error("Select at least one resource/equipment responsible office before forwarding.");
  }

  for (const a of assignments) {
    if (!a.assignedOffice) {
      throw new Error(`Missing responsible office for ${a.resourceName}.`);
    }
    if (!a.resourceName.trim()) {
      throw new Error("Each resource assignment needs a name.");
    }
  }

  // Deduplicate identical office+resource rows so EO cannot create duplicate work items.
  const seen = new Set<string>();
  const deduped = assignments.filter((a) => {
    const key = [
      a.resourceKind,
      a.assignedOffice,
      a.venueId ?? "",
      a.equipmentId ?? "",
      a.resourceName.trim().toLowerCase(),
      a.quantity,
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const supabase = getSupabase();
  const { error: deleteErr } = await supabase
    .from("event_request_resource_assignments")
    .delete()
    .eq("request_id", id);
  if (deleteErr) throw deleteErr;

  const rows = deduped.map((a) => ({
    request_id: id,
    resource_kind: a.resourceKind,
    venue_id: a.venueId ?? null,
    equipment_id: a.equipmentId ?? null,
    resource_name: a.resourceName.trim(),
    quantity: Math.max(1, Math.floor(a.quantity || 1)),
    assigned_office: a.assignedOffice,
    status: "pending" as const,
    assigned_by: actorId,
    assigned_at: new Date().toISOString(),
  }));

  const { error: insertErr } = await supabase.from("event_request_resource_assignments").insert(rows);
  if (insertErr) throw insertErr;

  const { error } = await supabase
    .from("event_requests")
    .update({
      current_step: "resource_offices",
      needs_gso: deduped.some((a) => a.assignedOffice === "gso"),
    })
    .eq("id", id);
  if (error) throw error;

  const officeList = [...new Set(deduped.map((a) => resourceOfficeLabel(a.assignedOffice)))].join(", ");
  await supabase.from("event_request_history").insert({
    request_id: id,
    actor_id: actorId,
    action: "forwarded",
    step: "eo_schedule",
    comment: `EO assigned resources to: ${officeList}`,
  });

  await notifyUser({
    userId: row.submitted_by,
    title: "Sent to resource offices",
    body: `"${row.activity}" (${formatEventScheduleSnippet(row)}) was forwarded by EO to: ${officeList}.`,
    category: "approval",
    emailSubject: "EventLink: Sent to resource offices",
    emailText: `Your request "${row.activity}" was forwarded to: ${officeList}.\nSchedule: ${formatEventScheduleSnippet(row)}.`,
  });

  const notifiedOffices = [...new Set(deduped.map((a) => a.assignedOffice))];
  await Promise.all(
    notifiedOffices.map((office) =>
      notifyUsersWithRole(office, {
        title: "Resource review required",
        body: `"${row.activity}" needs ${resourceOfficeLabel(office)} review (${formatEventScheduleSnippet(row)}).`,
        category: "approval",
        emailSubject: "EventLink: Resource review required",
        emailText: `An event request requires ${resourceOfficeLabel(office)} review.\nEvent: ${row.activity}\nSchedule: ${formatEventScheduleSnippet(row)}.`,
      }),
    ),
  );
}

async function autoScheduleAfterResourceApprovals(requestId: string, actorId: string): Promise<void> {
  const row = await getRow(requestId);
  const assignments = row.event_request_resource_assignments ?? [];
  if (!assignments.length) return;
  if (assignments.some((a) => a.status !== "approved")) return;

  const supabase = getSupabase();

  // Deduct equipment stock once per unique equipment item after all offices approve.
  const equipmentQtyById = new Map<string, number>();
  for (const a of assignments) {
    if (a.resource_kind !== "equipment" || !a.equipment_id) continue;
    const qty = Math.max(1, Number(a.quantity ?? 1));
    equipmentQtyById.set(a.equipment_id, Math.max(equipmentQtyById.get(a.equipment_id) ?? 0, qty));
  }
  for (const [equipmentId, qty] of equipmentQtyById) {
    const { data: eqRow, error: eqFetchError } = await supabase
      .from("equipment")
      .select("id, quantity_available")
      .eq("id", equipmentId)
      .single();
    if (eqFetchError || !eqRow) continue;
    const current = Math.max(0, Number(eqRow.quantity_available ?? 0));
    await supabase
      .from("equipment")
      .update({ quantity_available: Math.max(0, current - qty) })
      .eq("id", equipmentId);
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("event_requests")
    .update({
      status: "approved",
      current_step: null,
      calendar_posted_at: now,
    })
    .eq("id", requestId);
  if (error) throw error;

  await supabase.from("event_request_history").insert({
    request_id: requestId,
    actor_id: actorId,
    action: "scheduled",
    step: "resource_offices",
    comment: "All resource offices approved — event automatically scheduled",
  });

  await notifyUser({
    userId: row.submitted_by,
    title: "Event scheduled",
    body: `"${row.activity}" is scheduled on the staff calendar (${formatEventScheduleSnippet(row)}).`,
    category: "calendar",
    emailSubject: "EventLink: Event scheduled",
    emailText: `Your event "${row.activity}" is now scheduled.\n${formatEventScheduleSnippet(row)}.`,
  });
}

export async function approveResourceAssignment(
  requestId: string,
  actorId: string,
  actorRole: AppRole,
): Promise<void> {
  const office = appRoleToResourceOffice(actorRole);
  if (!office) throw new Error("This role cannot approve resource assignments.");

  const row = await getRow(requestId);
  if (row.status !== "pending" || row.current_step !== "resource_offices") {
    throw new Error("This request is not awaiting resource-office approval.");
  }

  const mine = (row.event_request_resource_assignments ?? []).filter(
    (a) => a.assigned_office === office && a.status === "pending",
  );
  if (!mine.length) {
    throw new Error("No pending resources are assigned to your office for this request.");
  }

  const supabase = getSupabase();
  const now = new Date().toISOString();
  for (const a of mine) {
    const { error } = await supabase
      .from("event_request_resource_assignments")
      .update({
        status: "approved",
        decided_by: actorId,
        decided_at: now,
        decline_reason: null,
      })
      .eq("id", a.id);
    if (error) throw error;
  }

  await supabase.from("event_request_history").insert({
    request_id: requestId,
    actor_id: actorId,
    action: "approved",
    step: "resource_offices",
    comment: `${resourceOfficeLabel(office)} approved assigned resources`,
  });

  await autoScheduleAfterResourceApprovals(requestId, actorId);
}

export async function declineResourceAssignment(
  requestId: string,
  actorId: string,
  actorRole: AppRole,
  reason: string,
): Promise<void> {
  const office = appRoleToResourceOffice(actorRole);
  if (!office) throw new Error("This role cannot decline resource assignments.");

  const cleanReason = reason.trim();
  if (!cleanReason) throw new Error("A decline reason is required.");

  const row = await getRow(requestId);
  if (row.status !== "pending" || row.current_step !== "resource_offices") {
    throw new Error("This request is not awaiting resource-office approval.");
  }

  const mine = (row.event_request_resource_assignments ?? []).filter(
    (a) => a.assigned_office === office && a.status === "pending",
  );
  if (!mine.length) {
    throw new Error("No pending resources are assigned to your office for this request.");
  }

  const supabase = getSupabase();
  const now = new Date().toISOString();
  for (const a of mine) {
    const { error } = await supabase
      .from("event_request_resource_assignments")
      .update({
        status: "declined",
        decided_by: actorId,
        decided_at: now,
        decline_reason: cleanReason,
      })
      .eq("id", a.id);
    if (error) throw error;
  }

  const { error } = await supabase
    .from("event_requests")
    .update({
      status: "declined",
      decline_reason: `${resourceOfficeLabel(office)}: ${cleanReason}`,
      declined_at_step: "resource_offices",
      current_step: null,
    })
    .eq("id", requestId);
  if (error) throw error;

  await supabase.from("event_request_history").insert({
    request_id: requestId,
    actor_id: actorId,
    action: "declined",
    step: "resource_offices",
    comment: `${resourceOfficeLabel(office)} declined: ${cleanReason}`,
  });

  await notifyUser({
    userId: row.submitted_by,
    title: "Request declined by resource office",
    body: `"${row.activity}" (${formatEventScheduleSnippet(row)}) was declined by ${resourceOfficeLabel(office)}. Reason: ${cleanReason}`,
    category: "approval",
    emailSubject: "EventLink: Resource office declined",
    emailText: `Your request "${row.activity}" was declined by ${resourceOfficeLabel(office)}.\nReason: ${cleanReason}\nSchedule: ${formatEventScheduleSnippet(row)}\n\nYou can edit and resubmit from the Events page.`,
  });
}

export async function declineEventRequest(
  id: string,
  actorId: string,
  actorRole: AppRole,
  reason: string,
): Promise<void> {
  const row = await getRow(id);
  if (row.status !== "pending") {
    throw new Error("Only pending requests can be declined.");
  }
  await assertActorCanHandleCurrentStep(row, actorId, actorRole);

  const supabase = getSupabase();
  const { error } = await supabase
    .from("event_requests")
    .update({
      status: "declined",
      decline_reason: reason.trim() || "Declined",
      declined_at_step: row.current_step,
    })
    .eq("id", id);
  if (error) throw error;

  await supabase.from("event_request_history").insert({
    request_id: id,
    actor_id: actorId,
    action: "declined",
    step: row.current_step,
    comment: reason.trim() || "Declined",
  });

  const cleanReason = reason.trim() || "No reason provided.";
  await notifyUser({
    userId: row.submitted_by,
    title: "Request declined",
    body: `"${row.activity}" (${formatEventScheduleSnippet(row)}) was declined at ${stepLabel(row.current_step)}. Reason: ${cleanReason}`,
    category: "approval",
    emailSubject: "EventLink: Request declined",
    emailText: `Your request "${row.activity}" was declined at ${stepLabel(row.current_step)}.\nReason: ${cleanReason}\nSchedule: ${formatEventScheduleSnippet(row)}\n\nYou can edit and resend your request from the Events page.`,
  });
}

function assertReadyForPublishStep(row: EventRequestRow): void {
  const ready =
    row.current_step === "eo_publish" &&
    (row.status === "approved" || row.status === "pending");
  if (!ready) {
    throw new Error("Event is not ready to publish. Complete prior approvals first.");
  }
}

/** SSC / student officer — visible on /student (caption + optional image). */
export async function postEventToStudents(
  id: string,
  actorId: string,
  actorRole: AppRole,
  input: PublishStudentPostInput,
): Promise<void> {
  if (actorRole !== "student_officer" && actorRole !== "ssc") {
    throw new Error("Only SSC or a student officer can post to the student dashboard.");
  }

  const caption = input.caption.trim();
  if (!caption) {
    throw new Error("Please write a caption for your post.");
  }

  const row = await getRow(id);
  if (row.status === "posted") {
    throw new Error("Event is already on the student dashboard.");
  }
  if (row.submitted_by !== actorId) {
    throw new Error("You can only publish your own event requests.");
  }
  assertReadyForPublishStep(row);

  let imagePath: string | null = null;
  if (input.imageFile) {
    imagePath = await uploadEventPostImage(input.imageFile, actorId, id);
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("event_requests")
    .update({
      status: "posted",
      current_step: null,
      posted_at: new Date().toISOString(),
      student_post_caption: caption,
      student_post_image_path: imagePath,
    })
    .eq("id", id);
  if (error) throw error;

  await supabase.from("event_request_history").insert({
    request_id: id,
    actor_id: actorId,
    action: "posted",
    step: "eo_publish",
    comment: `Published to student dashboard (${actorRole === "ssc" ? "SSC" : "Student organization"})`,
  });

  await notifyUser({
    userId: row.submitted_by,
    title: "Published to student feed",
    body: `"${row.activity}" is now live on the student dashboard (${formatEventScheduleSnippet(row)}).`,
    category: "system",
    emailSubject: "EventLink: Posted to students",
    emailText: `Your event "${row.activity}" is now published on the student dashboard feed.\n${formatEventScheduleSnippet(row)}.`,
  });
}

/** Executive Officer — staff schedule calendar only (not /student). */
export async function postEventToStaffCalendar(id: string, actorId: string): Promise<void> {
  const row = await getRow(id);
  if (row.calendar_posted_at) {
    throw new Error("Event is already on the staff calendar.");
  }
  assertReadyForPublishStep(row);

  const supabase = getSupabase();
  const { error } = await supabase
    .from("event_requests")
    .update({
      calendar_posted_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;

  await supabase.from("event_request_history").insert({
    request_id: id,
    actor_id: actorId,
    action: "calendar_posted",
    step: "eo_publish",
    comment: "Published to staff schedule calendar",
  });

  await notifyUser({
    userId: row.submitted_by,
    title: "Published to staff calendar",
    body: `"${row.activity}" was posted to the staff schedule calendar (${formatEventScheduleSnippet(row)}).`,
    category: "calendar",
    emailSubject: "EventLink: Posted to staff calendar",
    emailText: `Your event "${row.activity}" was posted to the staff schedule calendar.\n${formatEventScheduleSnippet(row)}.`,
  });
}

export function filterPendingForRole(
  rows: EventRequestRow[],
  role: AppRole,
  userId: string,
  scope?: { collegeId?: string | null; organizationId?: string | null },
): EventRequestRow[] {
  const office = appRoleToResourceOffice(role);

  return rows.filter((r) => {
    if (role === "student_officer") {
      if (scope?.organizationId) {
        return (
          r.request_type === "student_officer" &&
          r.organization_id === scope.organizationId &&
          r.status === "pending" &&
          r.current_step !== "eo_publish"
        );
      }
      return (
        r.request_type === "student_officer" &&
        r.submitted_by === userId &&
        r.status === "pending" &&
        r.current_step !== "eo_publish"
      );
    }
    if (role === "ssc") {
      // Keep SSC-submitted requests visible through resource-office approval.
      // Venue-assignment inbox stays separate via filterResourceOfficePending.
      return (
        r.request_type === "ssc" &&
        r.status === "pending" &&
        r.current_step !== "eo_publish"
      );
    }
    if (r.status !== "pending" && r.status !== "approved") return false;
    if (role === "eo") {
      if (r.current_step === "eo_schedule") return true;
      if (r.current_step === "eo_publish") {
        return !r.calendar_posted_at && (r.status === "pending" || r.status === "approved");
      }
      return false;
    }
    if (office && (role === "gso" || role === "it_infrastructure" || role === "sports_office")) {
      return hasPendingAssignmentForOffice(r, office);
    }
    if (role === "adviser") {
      if (!scope?.organizationId) return false;
      return (
        r.status === "pending" &&
        r.current_step === "adviser" &&
        r.organization_id === scope.organizationId
      );
    }
    if (role === "dean") {
      if (!scope?.collegeId) return false;
      return (
        r.status === "pending" &&
        r.current_step === "dean" &&
        (r.organizations?.college_id ?? null) === scope.collegeId
      );
    }
    return r.status === "pending" && roleMatchesStep(role, r.current_step);
  });
}

function hasPendingAssignmentForOffice(row: EventRequestRow, office: ResourceOffice): boolean {
  if (row.status !== "pending") return false;
  // Legacy GSO step without assignments
  if (office === "gso" && row.current_step === "gso") return true;
  if (row.current_step !== "resource_offices") return false;
  return (row.event_request_resource_assignments ?? []).some(
    (a) => a.assigned_office === office && a.status === "pending",
  );
}

/** Pending resource requests assigned by EO to a specific office (incl. SSC venue manager). */
export function filterResourceOfficePending(
  rows: EventRequestRow[],
  office: ResourceOffice,
): EventRequestRow[] {
  return rows.filter((r) => hasPendingAssignmentForOffice(r, office));
}

export function filterApprovedForRole(
  rows: EventRequestRow[],
  role: AppRole,
  userId: string,
  scope?: { organizationId?: string | null },
): EventRequestRow[] {
  return rows.filter((r) => {
    if (role === "student_officer") {
      const isApprovedLike =
        r.status === "approved" || r.status === "posted" || (r.status === "pending" && r.current_step === "eo_publish");
      if (!isApprovedLike || r.request_type !== "student_officer") return false;
      if (scope?.organizationId) return r.organization_id === scope.organizationId;
      return r.submitted_by === userId;
    }
    if (role === "ssc") {
      return (
        r.request_type === "ssc" &&
        (r.status === "approved" || r.status === "posted" || (r.status === "pending" && r.current_step === "eo_publish"))
      );
    }
    if (r.status !== "approved" && r.status !== "posted") return false;
    return true;
  });
}

export function filterDeclinedForRole(
  rows: EventRequestRow[],
  role: AppRole,
  userId: string,
  scope?: { organizationId?: string | null },
): EventRequestRow[] {
  if (role === "student_officer") {
    return rows.filter((r) => {
      if (r.request_type !== "student_officer") return false;
      if (r.status !== "declined" && r.status !== "revision_requested") return false;
      if (scope?.organizationId) return r.organization_id === scope.organizationId;
      return r.submitted_by === userId;
    });
  }
  if (role === "ssc") {
    return rows.filter(
      (r) =>
        r.request_type === "ssc" && (r.status === "declined" || r.status === "revision_requested"),
    );
  }
  return [];
}

export function filterPostedEvents(rows: EventRequestRow[]): EventRequestRow[] {
  return rows.filter((r) => r.status === "posted");
}

/** Staff schedule calendar (EO publishes here). Cancelled events stay in history but leave the calendar. */
export function filterCalendarEvents(rows: EventRequestRow[]): EventRequestRow[] {
  return rows.filter((r) => r.calendar_posted_at != null && r.status !== "cancelled");
}

const CALENDAR_LIST_SELECT = `
  id, request_type, status, current_step, organization_id, submitted_by,
  activity, start_date, end_date, start_time, end_time, venue, venue_id,
  number_of_participants, sdgs, purpose, needs_gso,
  letter_path, decline_reason, declined_at_step,
  posted_at, calendar_posted_at, student_post_caption, student_post_image_path,
  created_at, updated_at,
  organizations ( id, name, college_id )
`;

/**
 * Load only scheduled events overlapping a date window (month/week/day views).
 * Does not pull the full event_requests table.
 */
export async function fetchCalendarEventsInRange(params: {
  startDate: string;
  endDate: string;
  limit?: number;
}): Promise<EventRequestRow[]> {
  const start = params.startDate.trim();
  const end = params.endDate.trim();
  if (!start || !end) return [];
  const limit = Math.min(200, Math.max(1, params.limit ?? 100));
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("event_requests")
    .select(CALENDAR_LIST_SELECT)
    .not("calendar_posted_at", "is", null)
    .neq("status", "cancelled")
    .lte("start_date", end)
    .gte("end_date", start)
    .order("start_date", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as unknown as EventRequestRow[];
}

/** Compact upcoming list for calendar side panels. */
export async function fetchUpcomingCalendarEvents(limit = 10): Promise<EventRequestRow[]> {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const start = `${yyyy}-${mm}-${dd}`;
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 60);
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

  const rows = await fetchCalendarEventsInRange({
    startDate: start,
    endDate: end,
    limit: Math.min(50, Math.max(1, limit)),
  });
  return rows.slice(0, Math.min(50, Math.max(1, limit)));
}

/**
 * Cancel a scheduled event (EO). Does not delete the row — status becomes cancelled.
 */
export async function cancelScheduledEventRequest(
  id: string,
  actorId: string,
  reason: string,
): Promise<void> {
  const cleanReason = reason.trim();
  if (!cleanReason) throw new Error("A cancellation note is required.");

  const row = await getRow(id);
  if (row.status === "cancelled") {
    throw new Error("This event is already cancelled.");
  }
  if (!row.calendar_posted_at || (row.status !== "approved" && row.status !== "posted")) {
    throw new Error("Only scheduled events can be cancelled from the calendar.");
  }

  const supabase = getSupabase();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("event_requests")
    .update({
      status: "cancelled",
      cancellation_reason: cleanReason,
      cancelled_at: now,
      cancelled_by: actorId,
      current_step: null,
    })
    .eq("id", id);
  if (error) throw error;

  await supabase.from("event_request_history").insert({
    request_id: id,
    actor_id: actorId,
    action: "cancelled",
    step: null,
    comment: cleanReason,
    metadata: {
      previous_start_date: row.start_date,
      previous_end_date: row.end_date,
      previous_start_time: row.start_time,
      previous_end_time: row.end_time,
      previous_venue: row.venue,
      cancellation_reason: cleanReason,
    },
  });

  await notifyUser({
    userId: row.submitted_by,
    title: "Event cancelled",
    body: `"${row.activity}" (${formatEventScheduleSnippet(row)}) was cancelled by the Executive Officer. Reason: ${cleanReason}`,
    category: "system",
    emailSubject: "EventLink: Event cancelled",
    emailText: `Your event "${row.activity}" was cancelled.\nSchedule: ${formatEventScheduleSnippet(row)}\nReason: ${cleanReason}`,
  });
}

/** Events visible in Event Monitoring for eligible roles. */
export function filterMonitoringForRole(
  rows: EventRequestRow[],
  role: AppRole,
  userId: string,
  scope?: { collegeId?: string | null; organizationId?: string | null },
): EventRequestRow[] {
  return rows.filter((r) => {
    if (role === "admin" || role === "osas") return true;
    if (role === "adviser") {
      if (!scope?.organizationId) return false;
      return r.organization_id === scope.organizationId;
    }
    if (role === "dean") {
      if (!scope?.collegeId) return false;
      return (r.organizations?.college_id ?? null) === scope.collegeId;
    }
    if (role === "student_officer") {
      if (scope?.organizationId) {
        return r.request_type === "student_officer" && r.organization_id === scope.organizationId;
      }
      return r.request_type === "student_officer" && r.submitted_by === userId;
    }
    if (role === "ssc") {
      return r.request_type === "ssc" || r.submitted_by === userId;
    }
    if (role === "eo") {
      return true;
    }
    return false;
  });
}

export type UpdateEventRequestInput = {
  activity: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  numberOfParticipants: number;
  sdgs?: string;
  purpose?: string;
  letterFile?: File | null;
};

export async function requestRevision(
  id: string,
  actorId: string,
  actorRole: AppRole,
  comment: string,
  attachmentFile?: File | null,
): Promise<void> {
  const cleanComment = comment.trim();
  if (!cleanComment) {
    throw new Error("Compliance comment is required.");
  }

  const allowed: AppRole[] = ["eo", "osas", "adviser", "dean", "admin"];
  if (!allowed.includes(actorRole)) {
    throw new Error("You cannot request a revision for this request.");
  }

  const row = await getRow(id);
  if (row.status !== "pending") {
    throw new Error("Only pending requests can be sent for revision.");
  }
  if (actorRole !== "admin") {
    await assertActorCanHandleCurrentStep(row, actorId, actorRole);
  }

  let attachmentPath: string | null = null;
  let attachmentName: string | null = null;
  if (attachmentFile) {
    const { uploadComplianceAttachment } = await import("@/services/complianceAttachmentStorage");
    const uploaded = await uploadComplianceAttachment(attachmentFile, actorId, id);
    attachmentPath = uploaded.path;
    attachmentName = uploaded.name;
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("event_requests")
    .update({
      status: "revision_requested",
      decline_reason: cleanComment,
      declined_at_step: row.current_step,
    })
    .eq("id", id);
  if (error) throw error;

  const { error: commentErr } = await supabase.from("event_request_compliance_comments").insert({
    request_id: id,
    comment: cleanComment,
    attachment_path: attachmentPath,
    attachment_name: attachmentName,
    sender_id: actorId,
    sender_role: actorRole,
  });
  if (commentErr) throw commentErr;

  await supabase.from("event_request_history").insert({
    request_id: id,
    actor_id: actorId,
    action: "revision_requested",
    step: row.current_step,
    comment: cleanComment,
  });

  await notifyUser({
    userId: row.submitted_by,
    title: "Revision requested for your event request.",
    body: `"${row.activity}" (${formatEventScheduleSnippet(row)}): ${cleanComment}`,
    category: "approval",
    emailSubject: "EventLink: Revision requested",
    emailText: `Revision requested for your event request "${row.activity}".\nSchedule: ${formatEventScheduleSnippet(row)}\n\n${cleanComment}\n\nOpen Event Monitoring to review the comment and resubmit.`,
  });
}

export async function updateEventRequest(
  id: string,
  input: UpdateEventRequestInput,
  actorId: string,
): Promise<void> {
  const row = await getRow(id);

  const available = await checkVenueAvailable(
    input.venue,
    input.startDate,
    input.endDate,
    id,
    input.startTime,
    input.endTime,
  );
  if (!available) {
    throw new Error(
      "This venue is already booked for an overlapping date and time. Choose a different time or venue.",
    );
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("event_requests")
    .update({
      activity: input.activity.trim(),
      start_date: input.startDate,
      end_date: input.endDate,
      start_time: input.startTime,
      end_time: input.endTime,
      venue: input.venue.trim(),
      number_of_participants: input.numberOfParticipants,
      sdgs: input.sdgs?.trim() ?? "",
      purpose: input.purpose?.trim() ?? "",
    })
    .eq("id", id);

  if (error) throw error;

  const newSchedule = formatEventScheduleSnippet({
    start_date: input.startDate,
    end_date: input.endDate,
    start_time: input.startTime,
    end_time: input.endTime,
    venue: input.venue.trim(),
  });

  await supabase.from("event_request_history").insert({
    request_id: id,
    actor_id: actorId,
    action: "updated",
    step: "eo_publish",
    comment: "Schedule details updated by Executive Officer",
    metadata: {
      previous_start_date: row.start_date,
      previous_end_date: row.end_date,
      previous_start_time: row.start_time,
      previous_end_time: row.end_time,
      previous_venue: row.venue,
      new_start_date: input.startDate,
      new_end_date: input.endDate,
      new_start_time: input.startTime,
      new_end_time: input.endTime,
      new_venue: input.venue.trim(),
    },
  });

  await notifyUser({
    userId: row.submitted_by,
    title: "Event schedule updated",
    body: `"${row.activity}" schedule was updated. New: ${newSchedule}.`,
    category: "calendar",
    emailSubject: "EventLink: Schedule updated",
    emailText: `The schedule for "${row.activity}" was updated.\nNew: ${newSchedule}\nPrevious: ${formatEventScheduleSnippet(row)}.`,
  });
}

export async function resubmitDeclinedEventRequest(
  id: string,
  input: UpdateEventRequestInput,
  actorId: string,
  actorRole: AppRole,
): Promise<void> {
  const row = await getRow(id);
  if (row.status !== "declined" && row.status !== "revision_requested") {
    throw new Error("Only declined or revision-requested requests can be edited and resubmitted.");
  }
  if (row.submitted_by !== actorId) {
    throw new Error("You can only resubmit your own requests.");
  }
  if (actorRole === "student_officer" && row.request_type !== "student_officer") {
    throw new Error("This request is not a Student Officer request.");
  }
  if (actorRole === "ssc" && row.request_type !== "ssc") {
    throw new Error("This request is not an SSC request.");
  }

  const available = await checkVenueAvailable(
    input.venue,
    input.startDate,
    input.endDate,
    id,
    input.startTime,
    input.endTime,
  );
  if (!available) {
    throw new Error(
      "This venue is already booked for an overlapping date and time. Choose a different time or venue.",
    );
  }

  const wasRevision = row.status === "revision_requested";
  const resumeStep =
    wasRevision && row.declined_at_step
      ? row.declined_at_step
      : getInitialStep(row.request_type);

  const supabase = getSupabase();
  const { error } = await supabase
    .from("event_requests")
    .update({
      activity: input.activity.trim(),
      start_date: input.startDate,
      end_date: input.endDate,
      start_time: input.startTime,
      end_time: input.endTime,
      venue: input.venue.trim(),
      number_of_participants: input.numberOfParticipants,
      sdgs: input.sdgs?.trim() ?? "",
      purpose: input.purpose?.trim() ?? "",
      status: "pending",
      current_step: resumeStep,
      decline_reason: null,
      declined_at_step: null,
    })
    .eq("id", id);
  if (error) throw error;

  if (input.letterFile) {
    const letterPath = await uploadEventLetter(input.letterFile, actorId, id);
    const { count } = await supabase
      .from("event_request_letters")
      .select("id", { count: "exact", head: true })
      .eq("request_id", id);
    const version = (count ?? 0) + 1;
    const { error: letterErr } = await supabase
      .from("event_requests")
      .update({ letter_path: letterPath })
      .eq("id", id);
    if (letterErr) throw letterErr;
    await supabase.from("event_request_letters").insert({
      request_id: id,
      letter_path: letterPath,
      label: `Version ${version} — Revised Proposal`,
      created_by: actorId,
    });
  }

  await supabase.from("event_request_history").insert({
    request_id: id,
    actor_id: actorId,
    action: "resubmitted",
    step: resumeStep,
    comment: wasRevision
      ? "Revision completed and resubmitted"
      : "Declined request edited and resubmitted",
  });

  await notifyUser({
    userId: row.submitted_by,
    title: "Event resubmitted successfully.",
    body: `"${input.activity.trim()}" was resubmitted (${formatEventScheduleSnippet({
      start_date: input.startDate,
      end_date: input.endDate,
      start_time: input.startTime,
      end_time: input.endTime,
      venue: input.venue,
    })}). Awaiting ${stepLabel(resumeStep)}.`,
    category: "approval",
    emailSubject: "EventLink: Request resubmitted",
    emailText: `Your request "${input.activity.trim()}" was resubmitted.\nSchedule: ${formatEventScheduleSnippet({
      start_date: input.startDate,
      end_date: input.endDate,
      start_time: input.startTime,
      end_time: input.endTime,
      venue: input.venue,
    })}\nNext: ${stepLabel(resumeStep)}.`,
  });
}
