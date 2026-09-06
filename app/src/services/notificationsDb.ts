import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  buildPaginatedResult,
  pageToRange,
  type PaginatedResult,
  type PaginationParams,
} from "@/types/pagination";

export type NotificationCategory = "approval" | "system" | "calendar" | "security" | "other";

export type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  category: NotificationCategory | null;
  read_at: string | null;
  created_at: string;
};

const NOTIFICATION_SELECT = "id, title, body, category, read_at, created_at";

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
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = getSupabase();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw error;
}
