import type { PortalProfileDefaults, PortalRoleKey } from "@/types/portalProfile";

const baseMember = "";
const baseLogin = "";

function statsStudent(): PortalProfileDefaults["activityStats"] {
  return [
    { id: "joined", label: "Posted events", value: 0, icon: "CalendarCheck" },
    { id: "saved", label: "Calendar events", value: 0, icon: "Bookmark" },
    { id: "feedback", label: "Your notifications", value: 0, icon: "MessageSquare" },
  ];
}

function statsApprover(): PortalProfileDefaults["activityStats"] {
  return [
    { id: "approved", label: "Approved requests", value: 0, icon: "CheckCircle" },
    { id: "pending", label: "Pending reviews", value: 0, icon: "Clock" },
    { id: "scheduled", label: "Scheduled events", value: 0, icon: "Calendar" },
  ];
}

function statsAdmin(): PortalProfileDefaults["activityStats"] {
  return [
    { id: "users", label: "Managed users", value: 0, icon: "Users" },
    { id: "orgs", label: "Active organizations", value: 0, icon: "Building2" },
    { id: "events", label: "Total events", value: 0, icon: "LayoutDashboard" },
  ];
}

export function getProfileDefaults(role: PortalRoleKey): PortalProfileDefaults {
  const common = {
    memberSince: baseMember,
    lastLogin: baseLogin,
    isOnline: true,
    phone: "+63 912 345 6789",
    course: "",
    program: "",
    yearLevel: "",
    organization: "",
    department: "",
    office: "",
    position: "",
  };

  const map: Record<PortalRoleKey, PortalProfileDefaults> = {
    student: {
      ...common,
      portalRole: "student",
      roleLabel: "Student",
      roleDescription: "Access campus events, schedules, and announcements.",
      studentOrEmployeeId: "",
      course: "",
      program: "",
      yearLevel: "",
      organization: "",
      activityStats: statsStudent(),
    },
    "student-officer": {
      ...common,
      portalRole: "student-officer",
      roleLabel: "Student Officer",
      roleDescription: "Submit and track event requests for your organization.",
      studentOrEmployeeId: "",
      course: "",
      program: "",
      yearLevel: "",
      organization: "",
      department: "",
      office: "",
      position: "",
      activityStats: statsApprover(),
    },
    ssc: {
      ...common,
      portalRole: "ssc",
      roleLabel: "SSC",
      roleDescription: "Coordinate student organizations and campus-wide programming.",
      studentOrEmployeeId: "21-0088",
      course: "CBAA",
      program: "BSBA",
      yearLevel: "",
      organization: "Supreme Student Council",
      department: "Student Affairs (OSAS)",
      office: "SSC Office",
      position: "President",
      activityStats: statsApprover(),
    },
    adviser: {
      ...common,
      portalRole: "adviser",
      roleLabel: "Adviser",
      roleDescription: "Review and endorse student-led events for your advisees.",
      studentOrEmployeeId: "EMP-2014-089",
      department: "College of Computing Studies",
      office: "CCSICT Faculty Room 212",
      position: "Program Adviser — BSIT",
      activityStats: statsApprover(),
    },
    dean: {
      ...common,
      portalRole: "dean",
      roleLabel: "Dean",
      roleDescription: "Approve college-level events and uphold academic standards.",
      studentOrEmployeeId: "EMP-2008-012",
      department: "College of Computing Studies",
      office: "Dean's Office — CICT Building",
      position: "Dean",
      activityStats: statsApprover(),
    },
    osas: {
      ...common,
      portalRole: "osas",
      roleLabel: "OSAS",
      roleDescription: "Oversee student life compliance and institutional event policy.",
      studentOrEmployeeId: "EMP-2019-044",
      department: "Office of Student Affairs and Services",
      office: "OSAS Main",
      position: "Student Development Officer",
      activityStats: statsApprover(),
    },
    eo: {
      ...common,
      portalRole: "eo",
      roleLabel: "Executive Officer",
      roleDescription: "Initial scheduling approvals and executive routing for major events.",
      studentOrEmployeeId: "EMP-2011-033",
      department: "Executive Affairs",
      office: "Executive Office",
      position: "Executive Officer",
      activityStats: statsApprover(),
    },
    gso: {
      ...common,
      portalRole: "gso",
      roleLabel: "GSO",
      roleDescription: "Facilities, logistics, and resource approvals for campus events.",
      studentOrEmployeeId: "EMP-2016-077",
      department: "General Services Office",
      office: "GSO Logistics",
      position: "GSO Supervisor",
      activityStats: statsApprover(),
    },
    "it-infrastructure": {
      ...common,
      portalRole: "it-infrastructure",
      roleLabel: "IT Infrastructure",
      roleDescription: "IT equipment availability and approvals for campus events.",
      studentOrEmployeeId: "EMP-IT-001",
      department: "IT Infrastructure",
      office: "IT Services",
      position: "IT Officer",
      activityStats: statsApprover(),
    },
    "sports-office": {
      ...common,
      portalRole: "sports-office",
      roleLabel: "Sports Office",
      roleDescription: "Sports facilities and venue approvals for campus events.",
      studentOrEmployeeId: "EMP-SP-001",
      department: "Sports Office",
      office: "Sports Complex",
      position: "Sports Officer",
      activityStats: statsApprover(),
    },
    admin: {
      ...common,
      portalRole: "admin",
      roleLabel: "Admin",
      roleDescription: "Manage users, registry data, and portal configuration.",
      studentOrEmployeeId: "EMP-ADMIN-001",
      department: "ICT Services",
      office: "Data Center Annex",
      position: "Portal Administrator",
      activityStats: statsAdmin(),
    },
  };

  return map[role];
}

export function roleToBadgeTone(role: PortalRoleKey) {
  const tones: Record<PortalRoleKey, import("@/types/portalProfile").RoleBadgeTone> = {
    student: "green",
    "student-officer": "green",
    ssc: "teal",
    adviser: "blue",
    dean: "purple",
    osas: "blue",
    eo: "orange",
    gso: "slate",
    "it-infrastructure": "teal",
    "sports-office": "blue",
    admin: "red",
  };
  return tones[role];
}
