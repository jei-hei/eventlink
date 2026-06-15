import { getSupabase } from "@/lib/supabase";
import type { EventFeedbackRow, FeedbackSummary, SubmitEventFeedbackInput } from "@/types/eventFeedback";

export const FEEDBACK_PRESET_COMMENTS = [
  "Great event, very informative!",
  "Well organized and engaging",
  "Could be improved with better timing",
  "Venue was perfect for this event",
  "Enjoyed the activities and interactions",
  "Would recommend to other students",
  "Needs better promotion next time",
] as const;

export async function submitEventFeedback(input: SubmitEventFeedbackInput): Promise<void> {
  if (input.rating < 1 || input.rating > 5) {
    throw new Error("Please select a rating from 1 to 5 stars.");
  }
  const comment = input.comment.trim();
  if (!comment) throw new Error("Please choose a comment.");

  const supabase = getSupabase();
  const { error } = await supabase.from("event_feedback").insert({
    feed_post_id: input.feedPostId,
    request_id: input.requestId ?? null,
    rating: input.rating,
    comment,
    improvement_tags: input.improvementTags ?? [],
  });
  if (error) throw error;
}

export async function fetchFeedbackForSubmitter(userId: string): Promise<EventFeedbackRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("event_feedback")
    .select(
      `
      *,
      student_feed_posts!inner (
        event_title,
        organization_id,
        submitted_by
      )
    `,
    )
    .eq("student_feed_posts.submitted_by", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EventFeedbackRow[];
}

export function summarizeFeedback(rows: EventFeedbackRow[]): FeedbackSummary {
  if (!rows.length) {
    return { total: 0, averageRating: 0, byPost: [] };
  }

  const total = rows.length;
  const averageRating = rows.reduce((s, r) => s + r.rating, 0) / total;

  const byPostMap = new Map<
    string,
    { eventTitle: string; count: number; sum: number }
  >();

  for (const row of rows) {
    const postId = row.feed_post_id ?? "unknown";
    const title = row.student_feed_posts?.event_title ?? "Event";
    const cur = byPostMap.get(postId) ?? { eventTitle: title, count: 0, sum: 0 };
    cur.count += 1;
    cur.sum += row.rating;
    byPostMap.set(postId, cur);
  }

  const byPost = [...byPostMap.entries()].map(([feedPostId, v]) => ({
    feedPostId,
    eventTitle: v.eventTitle,
    count: v.count,
    averageRating: v.sum / v.count,
  }));

  return { total, averageRating, byPost };
}
