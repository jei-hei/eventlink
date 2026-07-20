import { computed } from "vue";
import { useEventRequestsStore } from "@/stores/eventRequests";

/** True while the shared portal event list is loading for the first time. */
export function useEventsTableLoading() {
  const store = useEventRequestsStore();
  return computed(() => store.loading && !store.loaded);
}
