import { getSupabase } from "@/lib/supabase";
import {
  deleteEventPostImages,
  getEventPostImagePublicUrl,
  uploadEventPostImage,
} from "@/services/eventPostImageStorage";
import { getProfileAvatarPublicUrl } from "@/services/profileAvatarStorage";
import { fetchSscOrganization } from "@/services/organizationsDb";
import type { AppRole } from "@/types/appRole";
import type {
  CreateStudentFeedPostInput,
  StudentFeedPosterProfile,
  StudentFeedPostRow,
  UpdateStudentFeedPostInput,
} from "@/types/studentPost";
import type { StudentEvent } from "@/views/student/types";
import { getEventSchedulePhase } from "@/utils/eventSchedulePhase";
import { hashFeedbackAccessCode } from "@/utils/hashFeedbackAccessCode";

/** Public feed columns — never select feedback_access_code_hash. */
const FEED_PUBLIC_COLUMNS = `
  id,
  organization_id,
  submitted_by,
  request_id,
  caption,
  image_path,
  image_paths,
  event_title,
  event_date,
  event_time,
  venue,
  require_feedback_access_code,
  posted_at,
  created_at
`;

const FEED_SELECT = `
  ${FEED_PUBLIC_COLUMNS},
  organizations ( name ),
  event_requests ( start_date, end_date, start_time, end_time )
`;

const FEED_SELECT_WITH_LETTER = FEED_SELECT;

type PosterProfileQueryRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  organization_name: string | null;
  college_name: string | null;
  college_code: string | null;
};

export type StudentFeedPostsPage = {
  rows: StudentFeedPostRow[];
  hasMore: boolean;
  nextOffset: number;
};

function toPosterProfile(row: PosterProfileQueryRow): StudentFeedPosterProfile {
  return {
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    organizations: row.organization_name ? { name: row.organization_name } : null,
    colleges: row.college_name
      ? { name: row.college_name, code: row.college_code ?? "" }
      : null,
  };
}

/** Load real creator profiles for feed posts (submitted_by → profiles). */
async function attachPosterProfiles(rows: StudentFeedPostRow[]): Promise<StudentFeedPostRow[]> {
  if (!rows.length) return rows;
  const ids = [...new Set(rows.map((r) => r.submitted_by).filter(Boolean))];
  if (!ids.length) return rows;

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("get_public_feed_author_profiles", {
    p_user_ids: ids,
  });
  if (error) throw error;

  const byId = new Map<string, StudentFeedPosterProfile>();
  for (const row of (data ?? []) as unknown as PosterProfileQueryRow[]) {
    byId.set(row.id, toPosterProfile(row));
  }

  return rows.map((row) => ({
    ...row,
    profiles: byId.get(row.submitted_by) ?? row.profiles ?? null,
  }));
}

export function mapFeedPostToStudentEvent(row: StudentFeedPostRow): StudentEvent {
  const posted = new Date(row.posted_at);
  const imageUrls = (row.image_paths ?? [])
    .map((p) => getEventPostImagePublicUrl(p))
    .filter((u): u is string => !!u);
  const firstImageUrl = imageUrls[0] ?? (row.image_path ? getEventPostImagePublicUrl(row.image_path) : null);
  const poster = row.profiles;
  const posterName = (poster?.display_name ?? "").trim();
  const posterOrg = (poster?.organizations?.name ?? "").trim();
  const posterCollege = (poster?.colleges?.name ?? "").trim();
  const linkedRaw = row.event_requests;
  const linked = Array.isArray(linkedRaw) ? (linkedRaw[0] ?? null) : linkedRaw;
  const scheduleCompleted =
    !!linked &&
    getEventSchedulePhase({
      startDate: linked.start_date,
      endDate: linked.end_date,
      startTime: linked.start_time,
      endTime: linked.end_time,
    }) === "completed";
  const feedbackAvailable = !!row.request_id && scheduleCompleted;
  return {
    id: row.id,
    title: row.event_title,
    organization: posterOrg,
    posterName,
    posterCollege,
    posterAvatarUrl: getProfileAvatarPublicUrl(poster?.avatar_url),
    venue: row.venue ?? "TBA",
    day: posted.getDate(),
    date: row.event_date ?? "Date TBA",
    time: row.event_time ?? "TBA",
    emoji: "📅",
    caption: row.caption,
    imageUrl: firstImageUrl,
    imageUrls,
    postedAt: row.posted_at,
    requestId: row.request_id,
    letterPath: null,
    submittedBy: row.submitted_by,
    imagePaths: [
      ...(row.image_paths ?? []),
      ...(row.image_path && !(row.image_paths ?? []).includes(row.image_path) ? [row.image_path] : []),
    ],
    feedbackAvailable,
    requireFeedbackAccessCode: feedbackAvailable && !!row.require_feedback_access_code,
  };
}

export async function fetchStudentFeedPosts(): Promise<StudentFeedPostRow[]> {
  const page = await fetchStudentFeedPostsPage(0, 20);
  return page.rows;
}

export async function fetchStudentFeedPostsPage(
  offset = 0,
  limit = 20,
): Promise<StudentFeedPostsPage> {
  const supabase = getSupabase();
  const start = Math.max(0, offset);
  const sliceSize = Math.max(1, Math.min(100, limit));
  const end = start + sliceSize;
  const { data, error } = await supabase
    .from("student_feed_posts")
    .select(FEED_SELECT)
    .order("posted_at", { ascending: false })
    .range(start, end);
  if (error) throw error;
  const fetched = (data ?? []) as StudentFeedPostRow[];
  const hasMore = fetched.length > sliceSize;
  const sliced = hasMore ? fetched.slice(0, sliceSize) : fetched;
  const rows = await attachPosterProfiles(sliced);
  return {
    rows,
    hasMore,
    nextOffset: start + rows.length,
  };
}

export async function fetchFeedPostsBySubmitter(
  userId: string,
  limit = 20,
): Promise<StudentFeedPostRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("student_feed_posts")
    .select(FEED_SELECT_WITH_LETTER)
    .eq("submitted_by", userId)
    .order("posted_at", { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)));
  if (error) throw error;
  return attachPosterProfiles((data ?? []) as StudentFeedPostRow[]);
}

async function resolveOrganizationId(
  actorId: string,
  actorRole: AppRole,
  inputOrgId?: string | null,
): Promise<string | null> {
  if (inputOrgId) return inputOrgId;

  const supabase = getSupabase();
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", actorId)
    .maybeSingle();
  if (profileErr) throw profileErr;
  if (profile?.organization_id) return profile.organization_id;

  if (actorRole === "ssc") {
    const ssc = await fetchSscOrganization();
    return ssc?.id ?? null;
  }

  return null;
}

function formatTimeRange(startTime?: string | null, endTime?: string | null): string {
  const fmt = (t: string) => {
    const parts = t.split(":");
    if (parts.length < 2) return t;
    let h = parseInt(parts[0] ?? "0", 10);
    const m = parts[1] ?? "00";
    const am = h < 12;
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${m} ${am ? "AM" : "PM"}`;
  };
  const start = startTime ? fmt(startTime) : "";
  const end = endTime ? fmt(endTime) : "";
  if (start && end) return `${start} – ${end}`;
  return start || end || "";
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateRange(start: string, end: string): string {
  if (start === end) return formatShortDate(start);
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

async function resolveLinkedEventFields(requestId: string | null | undefined): Promise<{
  eventDate: string | null;
  eventTime: string | null;
  venue: string | null;
  feedbackAvailable: boolean;
}> {
  if (!requestId) {
    return { eventDate: null, eventTime: null, venue: null, feedbackAvailable: false };
  }

  const supabase = getSupabase();
  const { data: row, error } = await supabase
    .from("event_requests")
    .select("start_date, end_date, start_time, end_time, venue, status")
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("Linked event request was not found.");

  const phase = getEventSchedulePhase({
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    startTime: row.start_time as string,
    endTime: row.end_time as string,
  });
  if (phase === "upcoming") {
    throw new Error(
      "This linked event has not started yet. You can post for evaluation only after the event is completed.",
    );
  }
  if (phase === "ongoing") {
    throw new Error(
      "This linked event is still ongoing. Wait until it finishes before posting for evaluation.",
    );
  }

  return {
    eventDate: formatDateRange(String(row.start_date), String(row.end_date)),
    eventTime: formatTimeRange(row.start_time as string, row.end_time as string) || null,
    venue: (row.venue as string)?.trim() || null,
    feedbackAvailable: phase === "completed",
  };
}

export async function createStudentFeedPost(
  input: CreateStudentFeedPostInput,
  actorId: string,
  actorRole: AppRole,
): Promise<StudentFeedPostRow> {
  if (actorRole !== "student_officer" && actorRole !== "ssc") {
    throw new Error("Only SSC or a student officer can post to the student feed.");
  }

  const caption = input.caption.trim();
  const eventTitle = input.eventTitle.trim();
  if (!caption) throw new Error("Please write a caption for your post.");
  if (!eventTitle) throw new Error("Please enter an event title.");

  const organizationId = await resolveOrganizationId(actorId, actorRole, input.organizationId);
  const postId = crypto.randomUUID();
  const supabase = getSupabase();
  const files = input.imageFiles?.length
    ? input.imageFiles
    : input.imageFile
      ? [input.imageFile]
      : [];

  const linked = await resolveLinkedEventFields(input.requestId);
  const requireCode = linked.feedbackAvailable && !!input.requireFeedbackAccessCode;
  let codeHash: string | null = null;
  if (requireCode) {
    const code = input.feedbackAccessCode?.trim();
    if (!code) throw new Error("Enter an access code for feedback, or turn off the access-code requirement.");
    codeHash = await hashFeedbackAccessCode(code);
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("student_feed_posts")
    .insert({
      id: postId,
      organization_id: organizationId,
      submitted_by: actorId,
      request_id: input.requestId || null,
      caption,
      image_path: null,
      image_paths: [],
      event_title: eventTitle,
      event_date: linked.eventDate ?? (input.eventDate?.trim() || null),
      event_time: linked.eventTime ?? (input.eventTime?.trim() || null),
      venue: linked.venue ?? (input.venue?.trim() || null),
      require_feedback_access_code: requireCode,
      feedback_access_code_hash: codeHash,
    })
    .select(FEED_SELECT_WITH_LETTER)
    .single();
  if (insertErr) throw insertErr;

  if (files.length) {
    const uploadedPaths: string[] = [];
    try {
      for (const file of files) {
        const imagePath = await uploadEventPostImage(file, actorId, postId);
        uploadedPaths.push(imagePath);
      }
      const { data: updated, error: updateErr } = await supabase
        .from("student_feed_posts")
        .update({
          image_path: uploadedPaths[0] ?? null,
          image_paths: uploadedPaths,
        })
        .eq("id", postId)
        .select(FEED_SELECT_WITH_LETTER)
        .single();
      if (updateErr) throw updateErr;
      const [withPoster] = await attachPosterProfiles([updated as StudentFeedPostRow]);
      return withPoster!;
    } catch (imgErr) {
      await deleteEventPostImages(uploadedPaths).catch(() => undefined);
      await supabase.from("student_feed_posts").delete().eq("id", postId).eq("submitted_by", actorId);
      throw imgErr instanceof Error
        ? imgErr
        : new Error("Could not upload the photo. The post was not published.");
    }
  }

  const [withPoster] = await attachPosterProfiles([inserted as StudentFeedPostRow]);
  return withPoster!;
}

export async function updateStudentFeedPost(
  input: UpdateStudentFeedPostInput,
  actorId: string,
): Promise<StudentFeedPostRow> {
  const caption = input.caption.trim();
  const eventTitle = input.eventTitle.trim();
  if (!caption) throw new Error("Please write a caption for your post.");
  if (!eventTitle) throw new Error("Please enter an event title.");

  const supabase = getSupabase();
  const { data: existing, error: fetchErr } = await supabase
    .from("student_feed_posts")
    .select("id, submitted_by, image_path, image_paths")
    .eq("id", input.postId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!existing) throw new Error("Post not found.");
  if (existing.submitted_by !== actorId) {
    throw new Error("You can only edit your own posts.");
  }

  const patch: Record<string, unknown> = {
    caption,
    event_title: eventTitle,
    event_date: input.eventDate?.trim() || null,
    event_time: input.eventTime?.trim() || null,
    venue: input.venue?.trim() || null,
  };
  if (input.requestId !== undefined) {
    patch.request_id = input.requestId || null;
  }

  const replaceImages = input.imageFiles !== undefined || input.imageFile !== undefined;
  const files = replaceImages
    ? input.imageFiles?.length
      ? input.imageFiles
      : input.imageFile
        ? [input.imageFile]
        : []
    : null;

  if (files && files.length) {
    const uploadedPaths: string[] = [];
    for (const file of files) {
      const imagePath = await uploadEventPostImage(file, actorId, input.postId);
      uploadedPaths.push(imagePath);
    }
    patch.image_path = uploadedPaths[0] ?? null;
    patch.image_paths = uploadedPaths;

    const oldPaths = [
      ...((existing.image_paths as string[] | null) ?? []),
      ...((existing.image_path as string | null) ? [existing.image_path as string] : []),
    ];
    const uniqueOld = [...new Set(oldPaths.filter(Boolean))];
    if (uniqueOld.length) {
      const { deleteEventPostImages } = await import("@/services/eventPostImageStorage");
      await deleteEventPostImages(uniqueOld).catch(() => undefined);
    }
  }

  const { data: updated, error: updateErr } = await supabase
    .from("student_feed_posts")
    .update(patch)
    .eq("id", input.postId)
    .eq("submitted_by", actorId)
    .select(FEED_SELECT_WITH_LETTER)
    .single();
  if (updateErr) throw updateErr;

  const [withPoster] = await attachPosterProfiles([updated as StudentFeedPostRow]);
  return withPoster!;
}

/**
 * Delete a campus feed post owned by actorId.
 * Does not delete event_requests, monitoring, calendar, or feedback rows.
 * Feedback.feed_post_id is cleared by FK ON DELETE SET NULL (migration).
 */
export async function deleteStudentFeedPost(postId: string, actorId: string): Promise<void> {
  const supabase = getSupabase();
  const { data: row, error: fetchErr } = await supabase
    .from("student_feed_posts")
    .select("id, submitted_by, request_id, image_path, image_paths")
    .eq("id", postId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!row) throw new Error("Post not found.");
  if (row.submitted_by !== actorId) {
    throw new Error("You can only delete your own posts.");
  }

  // Prefer keeping feedback tied to the event request when the post is removed.
  if (row.request_id) {
    await supabase
      .from("event_feedback")
      .update({ request_id: row.request_id })
      .eq("feed_post_id", postId)
      .is("request_id", null);
  }

  const imagePaths = [
    ...((row.image_paths as string[] | null) ?? []),
    ...((row.image_path as string | null) ? [row.image_path as string] : []),
  ];
  const uniquePaths = [...new Set(imagePaths.filter(Boolean))];

  const { error: delErr } = await supabase
    .from("student_feed_posts")
    .delete()
    .eq("id", postId)
    .eq("submitted_by", actorId);
  if (delErr) throw delErr;

  if (uniquePaths.length) {
    const { deleteEventPostImages } = await import("@/services/eventPostImageStorage");
    await deleteEventPostImages(uniquePaths);
  }
}
