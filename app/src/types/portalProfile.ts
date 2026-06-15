export type PortalRoleKey =
  | "student"
  | "student-officer"
  | "ssc"
  | "adviser"
  | "dean"
  | "osas"
  | "eo"
  | "gso"
  | "admin";

export type RoleBadgeTone = "green" | "blue" | "purple" | "orange" | "red" | "teal" | "slate";

export type ActivityStatIconKey =
  | "CalendarCheck"
  | "Bookmark"
  | "MessageSquare"
  | "CheckCircle"
  | "Clock"
  | "Calendar"
  | "Users"
  | "Building2"
  | "LayoutDashboard";

export interface ActivityStatModel {
  id: string;
  label: string;
  value: number;
  icon: ActivityStatIconKey;
}

export interface PortalProfileDefaults {
  portalRole: PortalRoleKey;
  roleLabel: string;
  roleDescription: string;
  studentOrEmployeeId: string;
  phone: string;
  course: string;
  program: string;
  yearLevel: string;
  organization: string;
  department: string;
  office: string;
  position: string;
  memberSince: string;
  lastLogin: string;
  isOnline: boolean;
  activityStats: ActivityStatModel[];
}
