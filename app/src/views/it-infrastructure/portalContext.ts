import type { InjectionKey, Ref } from "vue";
import { inject } from "vue";
import type { ItEvent } from "./types";

export interface ItPortalContext {
  events: Ref<ItEvent[]>;
  approvedEvents: Ref<ItEvent[]>;
  scheduledEvents: Ref<ItEvent[]>;
  handleApprove: (id: string) => void;
  handleReject: (id: string) => void;
  useDb: Ref<boolean>;
}

export const itPortalKey: InjectionKey<ItPortalContext> = Symbol("itPortal");

export function useItPortal(): ItPortalContext {
  const ctx = inject(itPortalKey);
  if (!ctx) throw new Error("useItPortal must be used within ItLayout");
  return ctx;
}
