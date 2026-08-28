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

export type UpdateStudentFeedPostInput = {
  postId: string;
  caption: string;
  eventTitle: string;
  eventDate?: string;
  eventTime?: string;
  venue?: string;
  requestId?: string | null;
  /** When provided (including empty), replaces post images. Omit to keep existing images. */
  imageFiles?: File[];
  imageFile?: File | null;
};

/** @deprecated use CreateStudentFeedPostInput */
export type PublishStudentPostInput = Pick<CreateStudentFeedPostInput, "caption" | "imageFile">;

export type StudentFeedPosterProfile = {
  display_name: string;
  avatar_url: string | null;
  organizations: { name: string } | null;
  colleges: { name: string; code: string } | null;
};

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
  /** Org linked to the post row (event relationship); not used as poster identity. */
  organizations?: { name: string } | null;
  /** Actual creator profile via submitted_by → profiles. */
  profiles?: StudentFeedPosterProfile | null;
  event_requests?: { letter_path: string | null } | null;
};
