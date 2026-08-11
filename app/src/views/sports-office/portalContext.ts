import type { InjectionKey, Ref } from "vue";
import { inject } from "vue";
import type { SportsEvent } from "./types";

export interface SportsPortalContext {
  events: Ref<SportsEvent[]>;
  approvedEvents: Ref<SportsEvent[]>;
  scheduledEvents: Ref<SportsEvent[]>;
  handleApprove: (id: string) => void;
  handleReject: (id: string) => void;
  useDb: Ref<boolean>;
}

export const sportsPortalKey: InjectionKey<SportsPortalContext> = Symbol("sportsPortal");

export function useSportsPortal(): SportsPortalContext {
  const ctx = inject(sportsPortalKey);
  if (!ctx) throw new Error("useSportsPortal must be used within SportsLayout");
  return ctx;
}
