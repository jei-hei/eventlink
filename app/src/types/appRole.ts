import type { PortalRoleKey } from "@/types/portalProfile";

/** Matches Postgres `public.app_role`. */
export type AppRole =
  | "student"
  | "student_officer"
  | "ssc"
  | "adviser"
  | "dean"
  | "osas"
  | "eo"
  | "gso"
  | "admin";

export const APP_ROLES: AppRole[] = [
  "student",
  "student_officer",
  "ssc",
  "adviser",
  "dean",
  "osas",
  "eo",
  "gso",
  "admin",
];

export const ROLE_HOME_PATH: Record<AppRole, string> = {
  student: "/student",
  student_officer: "/student-officer",
  ssc: "/ssc",
  adviser: "/adviser",
  dean: "/dean",
  osas: "/osas",
  eo: "/executive-officer",
  gso: "/gso",
  admin: "/admin",
};

export function appRoleToPortalRole(role: AppRole): PortalRoleKey {
  if (role === "student_officer") return "student-officer";
  if (role === "eo") return "eo";
  return role as PortalRoleKey;
}

export function portalRoleToAppRole(role: PortalRoleKey): AppRole {
  if (role === "student-officer") return "student_officer";
  if (role === "eo") return "eo";
  return role as AppRole;
}
