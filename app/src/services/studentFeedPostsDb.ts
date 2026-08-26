import { getSupabase } from "@/lib/supabase";
import { getEventPostImagePublicUrl, uploadEventPostImage } from "@/services/eventPostImageStorage";
import { getProfileAvatarPublicUrl } from "@/services/profileAvatarStorage";
import { fetchSscOrganization } from "@/services/organizationsDb";
import type { AppRole } from "@/types/appRole";
import type {
  CreateStudentFeedPostInput,
  StudentFeedPosterProfile,
  StudentFeedPostRow,
} from "@/types/studentPost";
import type { StudentEvent } from "@/views/student/types";

const FEED_SELECT = `
  *,
  organizations ( name )
`;

const FEED_SELECT_WITH_LETTER = `
  ${FEED_SELECT},
  event_requests ( letter_path )
`;

const POSTER_PROFILE_SELECT = `
  id,
  display_name,
  avatar_url,
  organizations ( name ),
  colleges ( name, code )
`;

type PosterProfileQueryRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  organizations: { name: string } | null;
  colleges: { name: string; code: string } | null;
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
    organizations: row.organizations,
    colleges: row.colleges,
  };
}

/** Load real creator profiles for feed posts (submitted_by → profiles). */
async function attachPosterProfiles(rows: StudentFeedPostRow[]): Promise<StudentFeedPostRow[]> {
  if (!rows.length) return rows;
  const ids = [...new Set(rows.map((r) => r.submitted_by).filter(Boolean))];
  if (!ids.length) return rows;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select(POSTER_PROFILE_SELECT)
    .in("id", ids);
  if (error) throw error;

  const byId = new Map<string, StudentFeedPosterProfile>();
  for (const row of (data ?? []) as PosterProfileQueryRow[]) {
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
    letterPath: row.event_requests?.letter_path ?? null,
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

export async function fetchFeedPostsBySubmitter(userId: string): Promise<StudentFeedPostRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("student_feed_posts")
    .select(FEED_SELECT_WITH_LETTER)
    .eq("submitted_by", userId)
    .order("posted_at", { ascending: false });
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
      event_date: input.eventDate?.trim() || null,
      event_time: input.eventTime?.trim() || null,
      venue: input.venue?.trim() || null,
    })
    .select(FEED_SELECT_WITH_LETTER)
    .single();
  if (insertErr) throw insertErr;

  if (files.length) {
    try {
      const uploadedPaths: string[] = [];
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
      const msg = imgErr instanceof Error ? imgErr.message : String(imgErr);
      console.warn("Post saved but image upload failed:", msg);
      const [withPoster] = await attachPosterProfiles([inserted as StudentFeedPostRow]);
      return withPoster!;
    }
  }

  const [withPoster] = await attachPosterProfiles([inserted as StudentFeedPostRow]);
  return withPoster!;
}
