import type { AppRole } from "@/types/appRole";

/**
 * TEMPORARY development/testing switch.
 * Set to `false` before production so staff must complete Email OTP after password login.
 *
 * Admin-created users already get `email_confirm: true` from `admin-create-user`
 * (no confirmation link required to sign in with password).
 */
export const DEV_SKIP_STAFF_EMAIL_OTP = true;

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
  const domain = mail.trim().toLowerCase().split("@")[1] ?? "";
  return DEV_TEST_EMAIL_DOMAINS.has(domain);
}

/** Staff OTP after password login — skip during testing or for dummy email domains. */
export function shouldSkipStaffEmailOtp(mail: string, role: AppRole | null | undefined): boolean {
  if (!role || role === "student") return true;
  if (DEV_SKIP_STAFF_EMAIL_OTP) return true;
  return isDevTestEmailAddress(mail);
}
