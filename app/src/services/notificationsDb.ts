import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { sendNotificationEmail } from "@/services/notificationEmail";
import {
  buildPaginatedResult,
  pageToRange,
  type PaginatedResult,
  type PaginationParams,
} from "@/types/pagination";

export type NotificationCategory = "approval" | "system" | "calendar" | "security" | "other";
export type NotificationEventType =
  | "login_detected"
  | "request_submitted"
  | "request_approved"
  | "sent_to_resource_offices"
  | "resource_review_required"
  | "event_scheduled"
  | "resource_declined"
  | "request_declined"
  | "published_student_feed"
  | "published_staff_calendar"
  | "event_cancelled"
  | "revision_requested"
  | "schedule_updated"
  | "request_resubmitted";

export type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  category: NotificationCategory | null;
  read_at: string | null;
  created_at: string;
};

const NOTIFICATION_SELECT = "id, title, body, category, read_at, created_at";

export type EnqueueNotificationInput = {
  userId: string;
  eventType: NotificationEventType;
  /** Required for an authorized cross-user workflow notification. */
  requestId?: string | null;
  /** Stable per-recipient key used to make retries idempotent. */
  dedupKey: string;
  /** Short template fields only; title/body/category are selected by the server. */
  context?: {
    /** @deprecated Accepted during eventRequestsDb refactor; server derives workflow detail. */
    detail?: string;
    device?: string;
    ip?: string;
    location?: string;
    time?: string;
  };
};

/**
 * Enqueues an authorized in-app notification and its email outbox row.
 * Email delivery remains best effort; the in-app notification is authoritative.
 */
export async function enqueueNotification(input: EnqueueNotificationInput): Promise<string> {
  if (!isSupabaseConfigured) return "";
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("enqueue_notification", {
    p_user_id: input.userId,
    p_event_type: input.eventType,
    p_request_id: input.requestId ?? null,
    p_dedup_key: input.dedupKey.trim(),
    p_context: input.context ?? {},
  });
  if (error) throw error;

  const notificationId = String(data ?? "");
  if (!notificationId) throw new Error("Notification could not be enqueued.");
  try {
    await sendNotificationEmail({ notificationId });
  } catch {
    // The outbox keeps failed or pending email separate from the primary workflow.
  }
  return notificationId;
}

/** @deprecated Prefer fetchMyNotificationsPage. */
export async function fetchMyNotifications(limit = 20): Promise<NotificationRow[]> {
  const page = await fetchMyNotificationsPage({ page: 1, pageSize: Math.min(100, limit) });
  return page.rows;
}

export async function fetchMyNotificationsPage(
  params: PaginationParams = {},
): Promise<PaginatedResult<NotificationRow>> {
  if (!isSupabaseConfigured) {
    return buildPaginatedResult([], 0, 1, 20);
  }
  const { page, pageSize, from, to } = pageToRange(params.page, params.pageSize);
  const supabase = getSupabase();
  const { data, error, count } = await supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return buildPaginatedResult((data ?? []) as NotificationRow[], count ?? 0, page, pageSize);
}

export async function countMyUnreadNotifications(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = getSupabase();
  const { error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: id,
  });
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = getSupabase();
  const { error } = await supabase.rpc("mark_all_notifications_read");
  if (error) throw error;
}
