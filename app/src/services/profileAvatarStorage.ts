import { getSupabase } from "@/lib/supabase";
import { optimizeImageForUpload } from "@/services/imageUploadOptimize";

const BUCKET = "profile-avatars";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

export function isAvatarImageFile(file: File): boolean {
  if (IMAGE_TYPES.has(file.type)) return true;
  return IMAGE_EXT.test(file.name);
}

export async function uploadProfileAvatar(file: File, userId: string): Promise<string> {
  if (!isAvatarImageFile(file)) {
    throw new Error("Please upload a JPEG, PNG, WebP, or GIF image.");
  }

  const optimized = await optimizeImageForUpload(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.86 });
  const safeName = optimized.name.replace(/[^\w.\-() ]+/g, "_").trim() || "avatar.webp";
  const path = `${userId}/${Date.now()}_${safeName}`;

  const supabase = getSupabase();
  const { error } = await supabase.storage.from(BUCKET).upload(path, optimized, {
    upsert: true,
    contentType: optimized.type || undefined,
  });
  if (error) throw error;
  return path;
}

export function getProfileAvatarPublicUrl(pathOrUrl: string | null | undefined): string | null {
  const value = (pathOrUrl ?? "").trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const supabase = getSupabase();
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(value);
  return data.publicUrl || null;
}
