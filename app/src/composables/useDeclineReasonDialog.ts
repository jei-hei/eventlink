import { ref } from "vue";

export const DECLINE_REASON_MAX_LENGTH = 1000;

const open = ref(false);
const eventName = ref("");
let resolver: ((reason: string | null) => void) | null = null;

function settle(reason: string | null) {
  open.value = false;
  const resolve = resolver;
  resolver = null;
  resolve?.(reason);
}

/** Shared state for the single DeclineReasonModal mounted in App.vue. */
export function useDeclineReasonDialog() {
  /** Resolves with the trimmed reason, or null when the reviewer cancels. */
  function askDeclineReason(name: string): Promise<string | null> {
    if (resolver) settle(null);
    eventName.value = name;
    open.value = true;
    return new Promise((resolve) => {
      resolver = resolve;
    });
  }

  return {
    open,
    eventName,
    askDeclineReason,
    confirm: (reason: string) => settle(reason.trim()),
    cancel: () => settle(null),
  };
}
