import type { InjectionKey, Ref } from "vue";
import { inject } from "vue";
import type { AdviserEvent } from "./types";

export interface AdviserPortalContext {
  events: Ref<AdviserEvent[]>;
  approvedEvents: Ref<AdviserEvent[]>;
  scheduledEvents: Ref<AdviserEvent[]>;
  handleApprove: (id: string) => void;
  handleReject: (id: string) => void;
  handleRequestRevision: (
    id: string,
    comment: string,
    attachmentFile?: File | null,
  ) => void | Promise<void>;
  handleCreateEvent: (e: AdviserEvent) => void;
}

export const adviserPortalKey: InjectionKey<AdviserPortalContext> = Symbol("adviserPortal");

export function useAdviserPortal(): AdviserPortalContext {
  const ctx = inject(adviserPortalKey);
  if (!ctx) {
    throw new Error("useAdviserPortal must be used within AdviserLayout");
  }
  return ctx;
}
