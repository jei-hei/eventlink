import type { PortalEvent } from "@/types/portalEvent";

/** SSC / student officer — publish to /student */
export function canPostToStudents(event: PortalEvent): boolean {
  return Boolean(event.awaitingPublish) && !event.posted;
}

/** Executive Officer — publish to staff schedule calendar */
export function canPostToCalendar(event: PortalEvent): boolean {
  return Boolean(event.awaitingCalendarPost) && !event.calendarPosted;
}

export function publishStatusLabel(event: PortalEvent): string {
  if (event.posted) return "On student board";
  if (event.calendarPosted && event.awaitingPublish) return "On calendar · post to students";
  if (event.calendarPosted) return "On staff calendar";
  if (event.awaitingPublish) return "Ready to post to students";
  if (event.awaitingCalendarPost) return "Ready for EO calendar";
  return event.workflowStatus || "Pending";
}
