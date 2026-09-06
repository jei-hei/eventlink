/** Map unknown thrown values to short user-facing messages (no raw DB dumps). */

export function toUserFacingError(error: unknown, fallback = "Something went wrong."): string {
  if (error == null) return fallback;

  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message: unknown }).message ?? "")
        : typeof error === "string"
          ? error
          : "";

  const message = raw.trim();
  if (!message) return fallback;

  const lower = message.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("too many requests") || lower.includes("429")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (lower.includes("jwt") || lower.includes("not authenticated") || lower.includes("auth")) {
    return "Your session expired. Please sign in again.";
  }
  if (lower.includes("permission") || lower.includes("row-level security") || lower.includes("rls") || lower.includes("403")) {
    return "You do not have permission to perform this action.";
  }
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("failed to fetch")) {
    return "Network error. Check your connection and try again.";
  }
  if (lower.includes("timeout")) {
    return "The request timed out. Please try again.";
  }

  // Keep short app-thrown messages; hide verbose PostgREST internals.
  if (message.length > 160 || /PGRST|postgres|permission denied for/i.test(message)) {
    return fallback;
  }
  return message;
}
