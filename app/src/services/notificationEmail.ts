import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export type NotificationEmailInput = {
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
  const supabase = getSupabase();
  const { error } = await supabase.functions.invoke("send-notification-email", {
    body: {
      to: input.to.trim(),
      subject: input.subject.trim(),
      text: input.text.trim(),
    },
  });
  if (error) throw error;
}
