import { getSupabase } from "@/lib/supabase";

const BUCKET = "event-post-images";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

export function isPostImageFile(file: File): boolean {
  if (IMAGE_TYPES.has(file.type)) return true;
  return IMAGE_EXT.test(file.name);
}

export async function uploadEventPostImage(
  file: File,
  userId: string,
  requestId: string,
): Promise<string> {
  if (!isPostImageFile(file)) {
    throw new Error("Please upload a JPEG, PNG, WebP, or GIF image.");
  }

  const safeName = file.name.replace(/[^\w.\-() ]+/g, "_").trim() || "post.jpg";
  const path = `${userId}/${requestId}/${Date.now()}_${safeName}`;

  const supabase = getSupabase();
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

export function getEventPostImagePublicUrl(path: string): string | null {
  const supabase = getSupabase();
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl || null;
}
