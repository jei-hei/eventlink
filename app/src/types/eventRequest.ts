/** Postgres enums (public schema). */
export type DbRequestType = "student_officer" | "ssc" | "eo_direct";
export type DbRequestStatus = "pending" | "declined" | "approved" | "posted";
export type DbWorkflowStep = "adviser" | "dean" | "osas" | "eo_schedule" | "gso" | "eo_publish";

export type EventRequestRow = {
  id: string;
  request_type: DbRequestType;
  status: DbRequestStatus;
  current_step: DbWorkflowStep | null;
  organization_id: string | null;
  submitted_by: string;
  activity: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  venue: string;
  number_of_participants: number;
  sdgs: string;
  purpose: string;
  needs_gso: boolean;
  letter_path: string | null;
  decline_reason: string | null;
  declined_at_step: DbWorkflowStep | null;
  posted_at: string | null;
  calendar_posted_at: string | null;
  student_post_caption: string | null;
  student_post_image_path: string | null;
  created_at: string;
  updated_at: string;
  organizations?: { id?: string; name: string; college_id?: string } | null;
  profiles?: { display_name: string } | null;
  event_request_equipment?: Array<{
    quantity_requested: number;
    equipment?: { id: string; name: string } | null;
  }> | null;
};

export type EventRequestHistoryRow = {
  id: string;
  request_id: string;
  actor_id: string | null;
  action: string;
  step: DbWorkflowStep | null;
  comment: string | null;
  created_at: string;
  profiles?: { display_name: string } | null;
};

export type CreateEventRequestInput = {
  requestType: DbRequestType;
  organizationId?: string | null;
  activity: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  numberOfParticipants: number;
  sdgs?: string;
  purpose?: string;
  needsGso: boolean;
  letterFile?: File | null;
  equipment?: { equipmentId: string; quantity: number }[];
};
