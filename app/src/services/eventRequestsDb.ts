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
  buildWorkflowHistory,
  getInitialStep,
  getNextStep,
  roleMatchesStep,
  stepLabel,
  workflowStatusForStep,
} from "@/services/eventRequestWorkflow";
import type { DbWorkflowStep } from "@/types/eventRequest";

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

function mapStatus(row: EventRequestRow): PortalEvent["status"] {
  if (row.status === "declined") return "Pending";
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

  const wfStatus =
    row.status === "declined"
      ? "Rejected"
      : row.status === "posted"
        ? "Approved"
        : row.current_step === "eo_publish"
          ? "Pending EO"
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
    status: mapStatus(row),
    workflowStatus: wfStatus,
    organization: orgName,
    eventType: row.request_type === "ssc" ? "SSC Event" : "Student Event",
    description: parsedPurpose.cleanPurpose,
    purpose: parsedPurpose.cleanPurpose,
    itemsEquipment: equipmentSummary(row),
    startTime: formatTime(row.start_time),
    endTime: formatTime(row.end_time),
    participants: row.number_of_participants,
    sdgs: row.sdgs,
    requesterName: submitter,
    needsGSO: row.needs_gso,
    posted: row.status === "posted",
    calendarPosted: row.calendar_posted_at != null,
    awaitingPublish: row.current_step === "eo_publish" && row.status !== "posted",
    awaitingCalendarPost: row.current_step === "eo_publish" && !row.calendar_posted_at,
    declineReason: row.decline_reason ?? undefined,
    letterPath: row.letter_path,
    studentPostCaption: row.student_post_caption,
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
  *,
  organizations ( id, name, college_id ),
  profiles!event_requests_submitted_by_fkey ( display_name ),
  event_request_equipment ( quantity_requested, equipment ( id, name ) )
`;

const EVENT_REQUEST_LIST_SELECT_INNER_ORG = `
  *,
  organizations!inner ( id, name, college_id ),
  profiles!event_requests_submitted_by_fkey ( display_name ),
  event_request_equipment ( quantity_requested, equipment ( id, name ) )
`;

const PORTAL_LIST_LIMIT = 400;

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
  if (error) {
    const fallback = await supabase
      .from("event_requests")
      .select(`*, organizations ( id, name, college_id ), event_request_equipment ( quantity_requested, equipment ( id, name ) )`)
      .order("created_at", { ascending: false })
      .limit(PORTAL_LIST_LIMIT);
    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []) as EventRequestRow[];
  }
  return (data ?? []) as EventRequestRow[];
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
      return runEventRequestListQuery(EVENT_REQUEST_LIST_SELECT, (q) => q.eq("request_type", "ssc"));
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
      return runEventRequestListQuery(EVENT_REQUEST_LIST_SELECT, (q) =>
        q.or("and(status.eq.pending,current_step.eq.gso),status.in.(approved,posted)"),
      );
    case "osas":
      return runEventRequestListQuery(EVENT_REQUEST_LIST_SELECT, (q) =>
        q.or("and(status.eq.pending,current_step.eq.osas),status.in.(approved,posted)"),
      );
    case "eo":
      return runEventRequestListQuery(EVENT_REQUEST_LIST_SELECT, (q) =>
        q.or(
          "current_step.in.(eo_schedule,eo_publish),calendar_posted_at.not.is.null,status.in.(approved,posted)",
        ),
      );
    default:
      return fetchAllEventRequests();
  }
}

export async function fetchAllEventRequests(): Promise<EventRequestRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("event_requests")
    .select(EVENT_REQUEST_LIST_SELECT)
    .order("created_at", { ascending: false })
    .limit(PORTAL_LIST_LIMIT);

  if (error) {
    const fallback = await supabase
      .from("event_requests")
      .select(`*, organizations ( id, name, college_id ), event_request_equipment ( quantity_requested, equipment ( id, name ) )`)
      .order("created_at", { ascending: false })
      .limit(PORTAL_LIST_LIMIT);
    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []) as EventRequestRow[];
  }
  return (data ?? []) as EventRequestRow[];
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
): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("check_venue_availability", {
    p_venue: venue,
    p_start: startDate,
    p_end: endDate,
    p_exclude_id: excludeId ?? null,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function createEventRequest(
  input: CreateEventRequestInput,
  submittedBy: string,
): Promise<string> {
  if (
    (input.requestType === "student_officer" || input.requestType === "ssc") &&
    !input.letterFile
  ) {
    throw new Error("Please upload your Word letter (.doc or .docx).");
  }

  const available = await checkVenueAvailable(input.venue, input.startDate, input.endDate);
  if (!available) {
    throw new Error("This venue is already booked for the selected date range.");
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
        .update({ letter_path: letterPath })
        .eq("id", requestId);
      if (letterErr) throw letterErr;
    } catch (letterErr) {
      const msg = letterErr instanceof Error ? letterErr.message : String(letterErr);
      if (msg.toLowerCase().includes("row-level security") || msg.toLowerCase().includes("policy")) {
        throw new Error(
          "Event was created but the Word letter could not be saved. Run supabase/migrations/20260528120000_event_letters_storage.sql and 20260528200000_fix_event_requests_rls.sql in the Supabase SQL Editor, then try again.",
        );
      }
      throw letterErr;
    }
  }

  if (input.equipment?.length) {
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
    body: `${input.activity.trim()} was submitted and is now awaiting ${stepLabel(initialStep)}.`,
    category: "approval",
    emailSubject: "EventLink: Request submitted",
    emailText: `Your event request "${input.activity.trim()}" was submitted successfully and is awaiting ${stepLabel(initialStep)}.`,
  });

  return requestId;
}

async function getRow(id: string): Promise<EventRequestRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("event_requests")
    .select(`*, organizations ( id, name, college_id ), event_request_equipment ( quantity_requested, equipment ( id, name ) )`)
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
  // Workflow complete without a publish step (unusual); otherwise stay pending until EO posts.
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
  await notifyUser({
    userId: row.submitted_by,
    title: "Request approved",
    body: `${row.activity} was approved at ${stepLabel(row.current_step)}. Next: ${nextLabel}.`,
    category: "approval",
    emailSubject: "EventLink: Request approved",
    emailText: `Your request "${row.activity}" was approved at ${stepLabel(row.current_step)}. Next step: ${nextLabel}.`,
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
    body: `${row.activity} was declined at ${stepLabel(row.current_step)}. Reason: ${cleanReason}`,
    category: "approval",
    emailSubject: "EventLink: Request declined",
    emailText: `Your request "${row.activity}" was declined at ${stepLabel(row.current_step)}.\nReason: ${cleanReason}\n\nYou can edit and resend your request from the Events page.`,
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
    body: `${row.activity} is now live on the student dashboard.`,
    category: "system",
    emailSubject: "EventLink: Posted to students",
    emailText: `Your event "${row.activity}" is now published on the student dashboard feed.`,
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
    body: `${row.activity} was posted to the staff schedule calendar by EO.`,
    category: "calendar",
    emailSubject: "EventLink: Posted to staff calendar",
    emailText: `Your event "${row.activity}" was posted to the staff schedule calendar.`,
  });
}

export function filterPendingForRole(
  rows: EventRequestRow[],
  role: AppRole,
  userId: string,
  scope?: { collegeId?: string | null; organizationId?: string | null },
): EventRequestRow[] {
  return rows.filter((r) => {
    if (role === "student_officer") {
      // Organization-scoped visibility for student officer requests.
      if (scope?.organizationId) {
        return (
          r.request_type === "student_officer" &&
          r.organization_id === scope.organizationId &&
          r.status === "pending" &&
          r.current_step !== "eo_publish"
        );
      }
      // Fallback to own requests if organization is missing.
      return (
        r.request_type === "student_officer" &&
        r.submitted_by === userId &&
        r.status === "pending" &&
        r.current_step !== "eo_publish"
      );
    }
    if (role === "ssc") {
      // SSC role is organization-level scope; show all SSC requests.
      return r.request_type === "ssc" && r.status === "pending" && r.current_step !== "eo_publish";
    }
    if (r.status !== "pending" && r.status !== "approved") return false;
    if (role === "eo") {
      if (r.current_step === "eo_schedule") return true;
      if (r.current_step === "eo_publish") {
        return !r.calendar_posted_at && (r.status === "pending" || r.status === "approved");
      }
      return false;
    }
    if (role === "gso") {
      return r.status === "pending" && r.current_step === "gso";
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
      if (r.request_type !== "student_officer" || r.status !== "declined") return false;
      if (scope?.organizationId) return r.organization_id === scope.organizationId;
      return r.submitted_by === userId;
    });
  }
  if (role === "ssc") {
    return rows.filter((r) => r.request_type === "ssc" && r.status === "declined");
  }
  return [];
}

export function filterPostedEvents(rows: EventRequestRow[]): EventRequestRow[] {
  return rows.filter((r) => r.status === "posted");
}

/** Staff schedule calendar (EO publishes here). */
export function filterCalendarEvents(rows: EventRequestRow[]): EventRequestRow[] {
  return rows.filter((r) => r.calendar_posted_at != null);
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
};

export async function updateEventRequest(
  id: string,
  input: UpdateEventRequestInput,
  actorId: string,
): Promise<void> {
  const available = await checkVenueAvailable(input.venue, input.startDate, input.endDate, id);
  if (!available) {
    throw new Error("This venue is already booked for the selected date range.");
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

  await supabase.from("event_request_history").insert({
    request_id: id,
    actor_id: actorId,
    action: "updated",
    step: "eo_publish",
    comment: "Schedule details updated by Executive Officer",
  });
}

export async function resubmitDeclinedEventRequest(
  id: string,
  input: UpdateEventRequestInput,
  actorId: string,
  actorRole: AppRole,
): Promise<void> {
  const row = await getRow(id);
  if (row.status !== "declined") {
    throw new Error("Only declined requests can be edited and resubmitted.");
  }
  if (row.submitted_by !== actorId) {
    throw new Error("You can only resubmit your own declined requests.");
  }
  if (actorRole === "student_officer" && row.request_type !== "student_officer") {
    throw new Error("This request is not a Student Officer request.");
  }
  if (actorRole === "ssc" && row.request_type !== "ssc") {
    throw new Error("This request is not an SSC request.");
  }

  const available = await checkVenueAvailable(input.venue, input.startDate, input.endDate, id);
  if (!available) {
    throw new Error("This venue is already booked for the selected date range.");
  }

  const initialStep = getInitialStep(row.request_type);
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
      current_step: initialStep,
      decline_reason: null,
      declined_at_step: null,
    })
    .eq("id", id);
  if (error) throw error;

  await supabase.from("event_request_history").insert({
    request_id: id,
    actor_id: actorId,
    action: "resubmitted",
    step: initialStep,
    comment: "Declined request edited and resubmitted",
  });

  await notifyUser({
    userId: row.submitted_by,
    title: "Request resubmitted",
    body: `${input.activity.trim()} was edited and resubmitted. It is now awaiting ${stepLabel(initialStep)}.`,
    category: "approval",
    emailSubject: "EventLink: Request resubmitted",
    emailText: `Your request "${input.activity.trim()}" was edited and resubmitted. It is now awaiting ${stepLabel(initialStep)}.`,
  });
}
