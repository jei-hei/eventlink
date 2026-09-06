/** SHA-256 hex digest for feedback access codes (never store plaintext). */
export async function hashFeedbackAccessCode(code: string): Promise<string> {
  const normalized = code.trim();
  if (!normalized) throw new Error("Access code is required.");
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
