/** User-facing workflow status label (Scheduled → Approved for approval context). */
export function displayWorkflowStatus(status: string): string {
  if (status === "Scheduled" || /^scheduled$/i.test(status.trim())) return "Approved";
  return status;
}
