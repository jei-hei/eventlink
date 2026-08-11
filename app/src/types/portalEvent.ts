/** Shared event shape used across staff portals (UI). */
import type { ResourceOffice } from "@/types/resourceOffice";

export type WorkflowStatus =
  | "Pending Adviser"
  | "Pending Dean"
  | "Pending GSO"
  | "Pending OSAS"
  | "Pending EO"
  | "Pending EO Review"
  | "Pending GSO Approval"
  | "Pending Sports Office Approval"
  | "Pending IT Infrastructure Approval"
  | "Pending SSC Venue Approval"
  | "Pending Resource Offices"
  | "Approved"
  | "Rejected"
  | string;

export interface WorkflowStepUi {
  name: string;
  status: "completed" | "current" | "pending";
  timestamp?: string;
  approver?: string;
}

export interface PortalResourceAssignment {
  id: string;
  resourceKind: "venue" | "equipment";
  venueId: string | null;
  equipmentId: string | null;
  resourceName: string;
  quantity: number;
  assignedOffice: ResourceOffice;
  status: "pending" | "approved" | "declined";
  declineReason?: string | null;
}

export interface PortalEvent {
  id: string;
  name: string;
  date: string;
  venue: string;
  venueId?: string | null;
  status: "Conflict" | "Pending" | "Approved";
  workflowStatus?: WorkflowStatus;
  description?: string;
  requesterName?: string;
  requesterRole?: string;
  department?: string;
  organization?: string;
  eventType?: string;
  startTime?: string;
  endTime?: string;
  startDate?: string;
  endDate?: string;
  itemsEquipment?: string;
  equipmentLines?: Array<{ equipmentId: string; name: string; quantity: number }>;
  purpose?: string;
  letterContent?: string;
  letterPath?: string | null;
  studentPostCaption?: string | null;
  studentPostImagePath?: string | null;
  studentPostImageUrl?: string | null;
  postedAt?: string | null;
  remarks?: string;
  participants?: number | string;
  sdgs?: string;
  createdBy?: "Organization" | "EO" | "Adviser";
  activity?: string;
  numberOfParticipants?: number;
  assignedTo?: string;
  needsGSO?: boolean;
  posted?: boolean;
  calendarPosted?: boolean;
  awaitingPublish?: boolean;
  awaitingCalendarPost?: boolean;
  awaitingResourceAssignment?: boolean;
  resourceAssignments?: PortalResourceAssignment[];
  workflowHistory?: WorkflowStepUi[];
  declineReason?: string;
}
