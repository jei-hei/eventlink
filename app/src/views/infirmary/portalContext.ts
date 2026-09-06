import { inject, type InjectionKey, type Ref } from "vue";
import type { PortalEvent } from "@/types/portalEvent";

export type InfirmaryPortalContext = {
  scheduledEvents: Ref<PortalEvent[]>;
};

export const infirmaryPortalKey: InjectionKey<InfirmaryPortalContext> = Symbol("infirmaryPortal");

export function useInfirmaryPortal(): InfirmaryPortalContext {
  const ctx = inject(infirmaryPortalKey);
  if (!ctx) throw new Error("Infirmary portal context not provided.");
  return ctx;
}
