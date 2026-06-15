import { getSupabase } from "@/lib/supabase";
import { getEventPostImagePublicUrl, uploadEventPostImage } from "@/services/eventPostImageStorage";
import { fetchSscOrganization } from "@/services/organizationsDb";
import type { AppRole } from "@/types/appRole";
import type { CreateStudentFeedPostInput, StudentFeedPostRow } from "@/types/studentPost";
import type { StudentEvent } from "@/views/student/types";

const FEED_SELECT = `
  *,
  organizations ( name )
`;

const FEED_SELECT_WITH_LETTER = `
  ${FEED_SELECT},
  event_requests ( letter_path )
`;

export function mapFeedPostToStudentEvent(row: StudentFeedPostRow): StudentEvent {
  const posted = new Date(row.posted_at);
  return {
    id: row.id,
    title: row.event_title,
    organization: row.organizations?.name ?? "Organization",
    venue: row.venue ?? "TBA",
    day: posted.getDate(),
    date: row.event_date ?? "Date TBA",
    time: row.event_time ?? "TBA",
    emoji: "📅",
    caption: row.caption,
    imageUrl: row.image_path ? getEventPostImagePublicUrl(row.image_path) : null,
    postedAt: row.posted_at,
    requestId: row.request_id,
    letterPath: row.event_requests?.letter_path ?? null,
  };
}

export async function fetchStudentFeedPosts(): Promise<StudentFeedPostRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("student_feed_posts")
    .select(FEED_SELECT)
    .order("posted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StudentFeedPostRow[];
}

export async function fetchFeedPostsBySubmitter(userId: string): Promise<StudentFeedPostRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("student_feed_posts")
    .select(FEED_SELECT_WITH_LETTER)
    .eq("submitted_by", userId)
    .order("posted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StudentFeedPostRow[];
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

  const { data: inserted, error: insertErr } = await supabase
    .from("student_feed_posts")
    .insert({
      id: postId,
      organization_id: organizationId,
      submitted_by: actorId,
      request_id: input.requestId || null,
      caption,
      image_path: null,
      event_title: eventTitle,
      event_date: input.eventDate?.trim() || null,
      event_time: input.eventTime?.trim() || null,
      venue: input.venue?.trim() || null,
    })
    .select(FEED_SELECT_WITH_LETTER)
    .single();
  if (insertErr) throw insertErr;

  if (input.imageFile) {
    try {
      const imagePath = await uploadEventPostImage(input.imageFile, actorId, postId);
      const { data: updated, error: updateErr } = await supabase
        .from("student_feed_posts")
        .update({ image_path: imagePath })
        .eq("id", postId)
        .select(FEED_SELECT_WITH_LETTER)
        .single();
      if (updateErr) throw updateErr;
      return updated as StudentFeedPostRow;
    } catch (imgErr) {
      const msg = imgErr instanceof Error ? imgErr.message : String(imgErr);
      console.warn("Post saved but image upload failed:", msg);
      return inserted as StudentFeedPostRow;
    }
  }

  return inserted as StudentFeedPostRow;
}
