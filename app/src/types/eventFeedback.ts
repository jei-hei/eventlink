export type EventFeedbackRow = {
  id: string;
  request_id: string | null;
  feed_post_id: string | null;
  rating: number;
  improvement_tags: string[];
  comment: string | null;
  created_at: string;
  student_feed_posts?: {
    event_title: string;
    organization_id: string | null;
    submitted_by: string;
  } | null;
};

export type SubmitEventFeedbackInput = {
  feedPostId: string;
  requestId?: string | null;
  rating: number;
  comment: string;
  improvementTags?: string[];
};

export type FeedbackSummary = {
  total: number;
  averageRating: number;
  ratingCounts: Record<1 | 2 | 3 | 4 | 5, number>;
  byPost: { feedPostId: string; eventTitle: string; count: number; averageRating: number }[];
};
