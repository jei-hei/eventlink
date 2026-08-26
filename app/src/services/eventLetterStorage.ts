import { getSupabase } from "@/lib/supabase";

const BUCKET = "event-letters";

const PDF_TYPES = new Set(["application/pdf"]);
const PDF_EXT = /\.pdf$/i;

export function isPdfProposalFile(file: File): boolean {
  if (PDF_TYPES.has(file.type)) return true;
  return PDF_EXT.test(file.name);
}

/** @deprecated Use isPdfProposalFile — kept for older Word uploads still in storage. */
export function isWordLetterFile(file: File): boolean {
  return isPdfProposalFile(file);
}

export async function uploadEventLetter(
  file: File,
  userId: string,
  requestId: string,
): Promise<string> {
  if (!isPdfProposalFile(file)) {
    throw new Error("Please upload a PDF proposal (.pdf).");
  }

  const safeName = file.name.replace(/[^\w.\-() ]+/g, "_").trim() || "proposal.pdf";
  const path = `${userId}/${requestId}/${Date.now()}-${safeName}`;

  const supabase = getSupabase();
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || "application/pdf",
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
  return part || "proposal.pdf";
}

export function isPdfPath(path: string): boolean {
  return PDF_EXT.test(path);
}

/** Download helper for non-PDF legacy files. Prefer in-app PDF viewer for proposals. */
export async function downloadEventLetter(letterPath: string): Promise<boolean> {
  const url = await getEventLetterSignedUrl(letterPath);
  if (!url) {
    window.alert("Could not open the proposal file.");
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
