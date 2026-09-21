import type { AppRole } from "@/types/appRole";

const TRUST_KEY_PREFIX = "eventlink:trusted-device:";

function trustKey(mail: string): string {
  return `${TRUST_KEY_PREFIX}${mail.trim().toLowerCase()}`;
}

export function isAdminRole(role: AppRole | null | undefined): boolean {
  return role === "admin";
}

/** This browser already completed OTP for this email. Admin never uses this skip. */
export function isTrustedDevice(mail: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(trustKey(mail)) === "1";
}

export function markDeviceTrusted(mail: string): void {
  if (typeof window === "undefined") return;
  const normalized = mail.trim().toLowerCase();
  if (!normalized) return;
  window.localStorage.setItem(trustKey(normalized), "1");
}
