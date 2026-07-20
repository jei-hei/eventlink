export type CreateStudentFeedPostInput = {
  caption: string;
  imageFile?: File | null;
  imageFiles?: File[];
  eventTitle: string;
  eventDate?: string;
  eventTime?: string;
  venue?: string;
  /** Optional link to an event request (e.g. for letter download) */
  requestId?: string | null;
  organizationId?: string | null;
};

/** @deprecated use CreateStudentFeedPostInput */
export type PublishStudentPostInput = Pick<CreateStudentFeedPostInput, "caption" | "imageFile">;

export type StudentFeedPostRow = {
  id: string;
  organization_id: string | null;
  submitted_by: string;
  request_id: string | null;
  caption: string;
  image_path: string | null;
  image_paths: string[] | null;
  event_title: string;
  event_date: string | null;
  event_time: string | null;
  venue: string | null;
  posted_at: string;
  created_at: string;
  organizations?: { name: string } | null;
  event_requests?: { letter_path: string | null } | null;
};
