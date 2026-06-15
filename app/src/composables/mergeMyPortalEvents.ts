import type { Ref } from "vue";
import type { PortalEvent } from "@/types/portalEvent";

/** Dedupe pending + approved/posted requests for optional post prefill. */
export function mergeMyPortalEvents(...lists: Ref<PortalEvent[]>[]): PortalEvent[] {
  const byId = new Map<string, PortalEvent>();
  for (const list of lists) {
    for (const e of list.value) byId.set(e.id, e);
  }
  return [...byId.values()];
}
