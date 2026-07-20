import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export type NotificationCategory = "approval" | "system" | "calendar" | "security" | "other";

export type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  category: NotificationCategory | null;
  read_at: string | null;
  created_at: string;
};

export async function fetchMyNotifications(limit = 100): Promise<NotificationRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, category, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
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
