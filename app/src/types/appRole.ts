import type { PortalRoleKey } from "@/types/portalProfile";

/** Matches Postgres `public.app_role` (excluding deprecated `student`). */
export type AppRole =
  | "student_officer"
  | "ssc"
  | "adviser"
  | "dean"
  | "osas"
  | "eo"
  | "gso"
  | "it_infrastructure"
  | "sports_office"
  | "infirmary"
  | "nstp"
  | "admin";

/** Public campus events feed — no portal role required. */
export const PUBLIC_EVENTS_PATH = "/events";

export const APP_ROLES: AppRole[] = [
  "student_officer",
  "ssc",
  "adviser",
  "dean",
  "osas",
  "eo",
  "gso",
  "it_infrastructure",
  "sports_office",
  "infirmary",
  "nstp",
  "admin",
];

/** First page after login — each role's Dashboard (analytics), not Event Management. */
export const ROLE_HOME_PATH: Record<AppRole, string> = {
  student_officer: "/student-officer/analytics",
  ssc: "/ssc/analytics",
  adviser: "/adviser/analytics",
  dean: "/dean/analytics",
  osas: "/osas/analytics",
  eo: "/executive-officer/analytics",
  gso: "/gso/analytics",
  it_infrastructure: "/it-infrastructure/analytics",
  sports_office: "/sports-office/analytics",
  infirmary: "/infirmary",
  nstp: "/nstp",
  admin: "/admin",
};

export function appRoleToPortalRole(role: AppRole): PortalRoleKey {
  if (role === "student_officer") return "student-officer";
  if (role === "eo") return "eo";
  if (role === "it_infrastructure") return "it-infrastructure";
  if (role === "sports_office") return "sports-office";
  return role as PortalRoleKey;
}

export function portalRoleToAppRole(role: PortalRoleKey): AppRole {
  if (role === "student-officer") return "student_officer";
  if (role === "eo") return "eo";
  if (role === "it-infrastructure") return "it_infrastructure";
  if (role === "sports-office") return "sports_office";
  return role as AppRole;
}

/** Human-readable labels for topbars / profile (from auth role, not hardcoded demo text). */
export const APP_ROLE_LABEL: Record<AppRole, string> = {
  student_officer: "Student Officer",
  ssc: "SSC",
  adviser: "Adviser",
  dean: "Dean",
  osas: "OSAS",
  eo: "Executive Officer",
  gso: "GSO",
  it_infrastructure: "IT Infrastructure",
  sports_office: "Sports Office",
  infirmary: "Infirmary",
  nstp: "NSTP",
  admin: "Admin",
};

export function appRoleLabel(role: AppRole | null | undefined): string {
  if (!role) return "";
  return APP_ROLE_LABEL[role] ?? role;
}

/** Legacy DB value — may still appear in admin user lists; not assignable in the app. */
export const LEGACY_STUDENT_ROLE = "student" as const;

export function normalizeLoadedAppRole(raw: string | null | undefined): AppRole | null {
  if (!raw || raw === LEGACY_STUDENT_ROLE) return null;
  return (APP_ROLES as readonly string[]).includes(raw) ? (raw as AppRole) : null;
}
