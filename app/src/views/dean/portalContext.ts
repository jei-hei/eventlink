import type { InjectionKey, Ref } from "vue";
import { inject } from "vue";
import type { DeanEvent } from "./types";

export interface DeanPortalContext {
  events: Ref<DeanEvent[]>;
  approvedEvents: Ref<DeanEvent[]>;
  scheduledEvents: Ref<DeanEvent[]>;
  handleApprove: (id: string) => void;
  handleReject: (id: string) => void;
  handleCreateEvent: (e: DeanEvent) => void;
}

export const deanPortalKey: InjectionKey<DeanPortalContext> = Symbol("deanPortal");

export function useDeanPortal(): DeanPortalContext {
  const ctx = inject(deanPortalKey);
  if (!ctx) {
    throw new Error("useDeanPortal must be used within DeanLayout");
  }
  return ctx;
}
