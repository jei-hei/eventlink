import { getSupabase } from "@/lib/supabase";

const BUCKET = "compliance-attachments";

const ALLOWED_EXT = /\.(png|jpe?g|gif|webp|pdf|docx?|txt)$/i;
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

export function isAllowedComplianceAttachment(file: File): boolean {
  if (ALLOWED_TYPES.has(file.type)) return true;
  return ALLOWED_EXT.test(file.name);
}

export async function uploadComplianceAttachment(
  file: File,
  userId: string,
  requestId: string,
): Promise<{ path: string; name: string }> {
  if (!isAllowedComplianceAttachment(file)) {
    throw new Error("Attachment must be an image, PDF, Word, or text file.");
  }

  const safeName = file.name.replace(/[^\w.\-() ]+/g, "_").trim() || "attachment";
  const path = `${userId}/${requestId}/${Date.now()}-${safeName}`;

  const supabase = getSupabase();
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return { path, name: safeName };
}

export async function getComplianceAttachmentSignedUrl(path: string): Promise<string | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}
