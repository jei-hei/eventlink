import type { SscEvent } from "./types";

export const initialPendingEvents: SscEvent[] = [
  {
    id: "1",
    name: "Student Leadership Summit 2026",
    organization: "Supreme Student Council",
    date: "Mar20",
    venue: "Gymnasium",
    status: "Pending",
    workflowStatus: "Pending OSAS",
    description:
      "Annual leadership summit for all student organization leaders and officers.",
    eventType: "Student Event",
    purpose:
      "To develop leadership skills among student leaders and foster collaboration between different student organizations.",
    startTime: "8:00 AM",
    endTime: "5:00 PM",
    itemsEquipment:
      "Projector, sound system, tables, chairs for 200 participants, training materials",
    remarks:
      "Guest speakers from various industries confirmed. Lunch and snacks will be provided.",
    createdBy: "Organization",
    needsGSO: true,
    workflowHistory: [
      { name: "OSAS", status: "current", timestamp: undefined, approver: undefined },
      { name: "EO", status: "pending", timestamp: undefined, approver: undefined },
    ],
  },
  {
    id: "2",
    name: "University Week Celebration",
    organization: "Supreme Student Council",
    date: "Mar25",
    venue: "Open Gymnasium",
    status: "Pending",
    workflowStatus: "Pending EO",
    description:
      "Week-long celebration featuring various activities, competitions, and cultural performances.",
    eventType: "Student Event",
    purpose:
      "To celebrate the university's founding anniversary and promote school spirit and unity among students.",
    startTime: "7:00 AM",
    endTime: "6:00 PM",
    itemsEquipment:
      "Stage setup, professional sound and lighting system, tents, tables, chairs, decorations",
    remarks:
      "Event runs for 5 consecutive days (Mar 25-29). Requires coordination with all departments.",
    createdBy: "Organization",
    needsGSO: true,
    workflowHistory: [
      {
        name: "OSAS",
        status: "completed",
        timestamp: "Apr 27, 2026 - 9:00 AM",
        approver: "OSAS Director Carlos Ramos",
      },
      { name: "EO", status: "current", timestamp: undefined, approver: undefined },
    ],
  },
];

export const initialApprovedEvents: SscEvent[] = [
  {
    id: "5",
    name: "Freshmen Welcome Assembly",
    organization: "Supreme Student Council",
    date: "Mar01",
    venue: "Gymnasium",
    status: "Approved",
    workflowStatus: "Approved",
    description: "Welcome assembly for all incoming freshmen students across all departments.",
    eventType: "Student Event",
    purpose:
      "To welcome new students and introduce them to university life, student organizations, and campus resources.",
    startTime: "10:00 AM",
    endTime: "3:00 PM",
    itemsEquipment: "Projector, sound system, microphones, tables, chairs for 500 students",
    remarks:
      "All department representatives and student organizations to participate. Lunch provided.",
    createdBy: "Organization",
    needsGSO: true,
    workflowHistory: [
      {
        name: "OSAS",
        status: "completed",
        timestamp: "Apr 22, 2026 - 2:45 PM",
        approver: "OSAS Director Carlos Ramos",
      },
      {
        name: "EO",
        status: "completed",
        timestamp: "Apr 23, 2026 - 11:00 AM",
        approver: "Executive Officer Dr. Elena Santos",
      },
    ],
  },
];
