import type { ScheduledCalendarEvent } from "@/components/ScheduledEventsCalendar.vue";
import type { PortalEvent } from "@/types/portalEvent";

export function mapPortalEventsToCalendar(events: PortalEvent[]): ScheduledCalendarEvent[] {
  return events.map((e) => ({
    id: e.id,
    date: e.date,
    startDate: e.startDate,
    endDate: e.endDate,
    startTime: e.startTime,
    endTime: e.endTime,
    name: e.activity ?? e.name,
    venue: e.venue,
    organization: e.organization,
    eventType: e.eventType,
    status: e.workflowStatus ?? e.status,
    completed: e.status === "Cancelled" || e.workflowStatus === "Cancelled",
  }));
}
