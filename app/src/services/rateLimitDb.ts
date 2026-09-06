import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export type RateLimitAction =
  | "login"
  | "password_reset"
  | "event_submit"
  | "event_mutate"
  | "feedback_submit"
  | "file_upload"
  | "search";

const WINDOW_SECONDS: Record<RateLimitAction, number> = {
  login: 15 * 60,
  password_reset: 15 * 60,
  event_submit: 60,
  event_mutate: 30,
  feedback_submit: 60,
  file_upload: 60,
  search: 10,
};

const MAX_ATTEMPTS: Record<RateLimitAction, number> = {
  login: 8,
  password_reset: 5,
  event_submit: 10,
  event_mutate: 30,
  feedback_submit: 12,
  file_upload: 15,
  search: 40,
};

/**
 * Server-side rate limit check via RPC.
 * Fails open (allows) if the RPC is missing / unavailable so local/dev isn't blocked.
 */
export async function assertRateLimitAllowed(
  action: RateLimitAction,
  keyExtra = "",
): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_action: action,
      p_key_extra: keyExtra || null,
      p_max_attempts: MAX_ATTEMPTS[action],
      p_window_seconds: WINDOW_SECONDS[action],
    });
    if (error) {
      console.warn("[rateLimit] check skipped:", error.message);
      return;
    }
    const allowed = data === true || data === "true" || data == null;
    if (!allowed) {
      throw new Error("Too many attempts. Please wait a moment and try again.");
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Too many attempts")) throw e;
    console.warn("[rateLimit] check failed open:", e);
  }
}
