import type { InjectionKey, Ref } from "vue";
import { inject } from "vue";
import type { GsoEvent } from "./types";

export interface GsoPortalContext {
  events: Ref<GsoEvent[]>;
  approvedEvents: Ref<GsoEvent[]>;
  scheduledEvents: Ref<GsoEvent[]>;
  handleApprove: (id: string) => void;
  handleReject: (id: string) => void;
  handleCreateEvent: (e: GsoEvent) => void;
  useDb: Ref<boolean>;
}

export const gsoPortalKey: InjectionKey<GsoPortalContext> = Symbol("gsoPortal");

export function useGsoPortal(): GsoPortalContext {
  const ctx = inject(gsoPortalKey);
  if (!ctx) {
    throw new Error("useGsoPortal must be used within GsoLayout");
  }
  return ctx;
}
