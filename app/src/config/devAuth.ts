import type { AppRole } from "@/types/appRole";

/** Development-only switch. Production builds always require staff Email OTP. */
export const DEV_SKIP_STAFF_EMAIL_OTP =
  import.meta.env.DEV && import.meta.env.VITE_DEV_SKIP_STAFF_EMAIL_OTP === "true";

/** Domains treated as dummy/test emails (OTP skipped even if the flag above is false). */
export const DEV_TEST_EMAIL_DOMAINS = new Set([
  "eventlink.local",
  "university.edu",
  "example.com",
  "example.org",
  "test.local",
  "localhost",
]);

export function isDevTestEmailAddress(mail: string): boolean {
  if (!import.meta.env.DEV) return false;
  const domain = mail.trim().toLowerCase().split("@")[1] ?? "";
  return DEV_TEST_EMAIL_DOMAINS.has(domain);
}

/** Staff OTP may only be skipped by explicit development-only controls. */
export function shouldSkipStaffEmailOtp(mail: string, role: AppRole | null | undefined): boolean {
  if (!import.meta.env.DEV) return false;
  if (!role) return true;
  if (DEV_SKIP_STAFF_EMAIL_OTP) return true;
  return isDevTestEmailAddress(mail);
}
