/** Official ISU email domain used for staff accounts. */
export const ISU_EMAIL_DOMAIN = "isu.edu.ph";

export const ISU_EMAIL_ERROR = "Please use a valid ISU email address.";

export function isOfficialIsuEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return false;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  return Boolean(local) && domain === ISU_EMAIL_DOMAIN;
}
