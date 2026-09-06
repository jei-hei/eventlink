import { inject, type InjectionKey, type Ref } from "vue";
import type { PortalEvent } from "@/types/portalEvent";

export type NstpPortalContext = {
  scheduledEvents: Ref<PortalEvent[]>;
};

export const nstpPortalKey: InjectionKey<NstpPortalContext> = Symbol("nstpPortal");

export function useNstpPortal(): NstpPortalContext {
  const ctx = inject(nstpPortalKey);
  if (!ctx) throw new Error("NSTP portal context not provided.");
  return ctx;
}
