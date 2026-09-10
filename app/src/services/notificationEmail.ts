import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export type NotificationEmailInput = {
  notificationId: string;
} | {
  /** @deprecated Arbitrary email relay is disabled; enqueue a notification first. */
  to: string;
  subject: string;
  text: string;
};

/**
 * Best-effort email delivery via Supabase Edge Function.
 * Function failure should never break the primary workflow.
 */
export async function sendNotificationEmail(input: NotificationEmailInput): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (!("notificationId" in input) || !input.notificationId.trim()) {
    throw new Error("Enqueue a notification before requesting email delivery.");
  }
  const supabase = getSupabase();
  const { error } = await supabase.functions.invoke("send-notification-email", {
    body: {
      notificationId: input.notificationId.trim(),
    },
  });
  if (error) throw error;
}
