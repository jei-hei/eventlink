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

/** Authenticated blob download — avoids CORS on the public signed URL. */
export async function downloadEventLetterBytes(path: string): Promise<ArrayBuffer> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) {
    throw new Error(error?.message || "Could not load the proposal PDF.");
  }
  return data.arrayBuffer();
}

export function letterFileNameFromPath(path: string): string {
  const part = path.split("/").pop();
  return part || "proposal.pdf";
}

export function isPdfPath(path: string): boolean {
  return PDF_EXT.test(path);
}

/** Save the proposal as a file in this tab — do not open the signed storage URL. */
export async function downloadEventLetter(letterPath: string): Promise<boolean> {
  try {
    const bytes = await downloadEventLetterBytes(letterPath);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = letterFileNameFromPath(letterPath);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return true;
  } catch {
    window.alert("Could not download the proposal file.");
    return false;
  }
}
