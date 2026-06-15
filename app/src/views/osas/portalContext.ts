import type { InjectionKey, Ref } from "vue";
import { inject } from "vue";
import type { OsasEvent } from "./types";

export interface OsasPortalContext {
  events: Ref<OsasEvent[]>;
  approvedEvents: Ref<OsasEvent[]>;
  scheduledEvents: Ref<OsasEvent[]>;
  handleApprove: (id: string) => void;
  handleReject: (id: string) => void;
  handleCreateEvent: (e: OsasEvent) => void;
}

export const osasPortalKey: InjectionKey<OsasPortalContext> = Symbol("osasPortal");

export function useOsasPortal(): OsasPortalContext {
  const ctx = inject(osasPortalKey);
  if (!ctx) {
    throw new Error("useOsasPortal must be used within OsasLayout");
  }
  return ctx;
}
