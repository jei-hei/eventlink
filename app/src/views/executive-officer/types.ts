import type { PortalEvent } from "@/types/portalEvent";

export type EoEvent = PortalEvent;

export interface VenueBooking {
  date: string;
  event: string;
  organization: string;
  status: "booked" | "conflict";
}
