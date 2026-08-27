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

/** Feedback for one campus feed post only. */
export async function fetchFeedbackForFeedPost(feedPostId: string): Promise<EventFeedbackRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("event_feedback")
    .select(
      `
      *,
      student_feed_posts (
        event_title,
        organization_id,
        submitted_by
      )
    `,
    )
    .eq("feed_post_id", feedPostId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EventFeedbackRow[];
}

/** Feedback linked to an event request (via feed post request_id and/or feedback.request_id). */
export async function fetchFeedbackForRequest(requestId: string): Promise<EventFeedbackRow[]> {
  const supabase = getSupabase();
  const { data: byRequest, error: err1 } = await supabase
    .from("event_feedback")
    .select(
      `
      *,
      student_feed_posts (
        event_title,
        organization_id,
        submitted_by
      )
    `,
    )
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });
  if (err1) throw err1;

  const { data: posts, error: err2 } = await supabase
    .from("student_feed_posts")
    .select("id")
    .eq("request_id", requestId);
  if (err2) throw err2;

  const postIds = (posts ?? []).map((p) => p.id as string);
  let byPost: EventFeedbackRow[] = [];
  if (postIds.length) {
    const { data, error } = await supabase
      .from("event_feedback")
      .select(
        `
        *,
        student_feed_posts (
          event_title,
          organization_id,
          submitted_by
        )
      `,
      )
      .in("feed_post_id", postIds)
      .order("created_at", { ascending: false });
    if (error) throw error;
    byPost = (data ?? []) as EventFeedbackRow[];
  }

  const merged = new Map<string, EventFeedbackRow>();
  for (const row of [...((byRequest ?? []) as EventFeedbackRow[]), ...byPost]) {
    merged.set(row.id, row);
  }
  return [...merged.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function summarizeFeedback(rows: EventFeedbackRow[]): FeedbackSummary {
  const ratingCounts: FeedbackSummary["ratingCounts"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (!rows.length) {
    return { total: 0, averageRating: 0, ratingCounts, byPost: [] };
  }

  const total = rows.length;
  let sum = 0;
  for (const row of rows) {
    sum += row.rating;
    const r = Math.min(5, Math.max(1, Math.round(row.rating))) as 1 | 2 | 3 | 4 | 5;
    ratingCounts[r] += 1;
  }
  const averageRating = sum / total;

  const byPostMap = new Map<string, { eventTitle: string; count: number; sum: number }>();

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

  return { total, averageRating, ratingCounts, byPost };
}
