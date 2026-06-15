import { defineStore } from "pinia";
import { ref } from "vue";

/** Shared optimistic “pending action” flags for approval UIs. */
export const useApprovalsStore = defineStore("approvals", () => {
  const pendingIds = ref<Set<string>>(new Set());

  function start(id: string) {
    const next = new Set(pendingIds.value);
    next.add(id);
    pendingIds.value = next;
  }

  function end(id: string) {
    const next = new Set(pendingIds.value);
    next.delete(id);
    pendingIds.value = next;
  }

  function isPending(id: string) {
    return pendingIds.value.has(id);
  }

  return { pendingIds, start, end, isPending };
});
