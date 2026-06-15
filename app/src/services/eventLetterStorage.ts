import { getSupabase } from "@/lib/supabase";

const BUCKET = "event-letters";

const WORD_TYPES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const WORD_EXT = /\.(docx?|DOCX?)$/;

export function isWordLetterFile(file: File): boolean {
  if (WORD_TYPES.has(file.type)) return true;
  return WORD_EXT.test(file.name);
}

export async function uploadEventLetter(
  file: File,
  userId: string,
  requestId: string,
): Promise<string> {
  if (!isWordLetterFile(file)) {
    throw new Error("Please upload a Word document (.doc or .docx).");
  }

  const safeName = file.name.replace(/[^\w.\-() ]+/g, "_").trim() || "letter.docx";
  const path = `${userId}/${requestId}/${safeName}`;

  const supabase = getSupabase();
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

export async function getEventLetterSignedUrl(path: string): Promise<string | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

export function letterFileNameFromPath(path: string): string {
  const part = path.split("/").pop();
  return part || "letter.docx";
}

/** Download the original Word file uploaded with the event request. */
export async function downloadEventLetter(letterPath: string): Promise<boolean> {
  const url = await getEventLetterSignedUrl(letterPath);
  if (!url) {
    window.alert("Could not open the letter file.");
    return false;
  }
  const a = document.createElement("a");
  a.href = url;
  a.download = letterFileNameFromPath(letterPath);
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
}
