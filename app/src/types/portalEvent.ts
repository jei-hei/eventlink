/** Shared event shape used across staff portals (UI). */
export type WorkflowStatus =
  | "Pending Adviser"
  | "Pending Dean"
  | "Pending GSO"
  | "Pending OSAS"
  | "Pending EO"
  | "Approved"
  | "Rejected";

export interface WorkflowStepUi {
  name: string;
  status: "completed" | "current" | "pending";
  timestamp?: string;
  approver?: string;
}

export interface PortalEvent {
  id: string;
  name: string;
  date: string;
  venue: string;
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
  purpose?: string;
  letterContent?: string;
  /** Supabase storage path for uploaded Word letter */
  letterPath?: string | null;
  /** Caption on the student feed after publishing */
  studentPostCaption?: string | null;
  /** Storage path for optional feed image */
  studentPostImagePath?: string | null;
  /** Public URL for feed image (resolved client-side) */
  studentPostImageUrl?: string | null;
  postedAt?: string | null;
  remarks?: string;
  participants?: number | string;
  sdgs?: string;
  createdBy?: "Organization" | "EO" | "Adviser";
  /** Alias used in some portal views */
  activity?: string;
  numberOfParticipants?: number;
  assignedTo?: string;
  needsGSO?: boolean;
  posted?: boolean;
  /** Published on the staff schedule calendar (EO). */
  calendarPosted?: boolean;
  /** At eo_publish step, ready for org to post to /student */
  awaitingPublish?: boolean;
  /** At eo_publish step, ready for EO to post to staff calendar */
  awaitingCalendarPost?: boolean;
  workflowHistory?: WorkflowStepUi[];
  declineReason?: string;
}
