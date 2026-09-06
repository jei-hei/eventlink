import { ref } from "vue";
import { toUserFacingError } from "@/utils/userFacingError";

/**
 * Prevents duplicate concurrent submissions (Approve, Forward, Upload, etc.).
 * Client UX guard — not a substitute for server-side rate limits.
 */
export function useActionLock() {
  const busy = ref(false);
  const error = ref<string | null>(null);

  async function run<T>(action: () => Promise<T>, fallbackError = "Action failed."): Promise<T | undefined> {
    if (busy.value) return undefined;
    busy.value = true;
    error.value = null;
    try {
      return await action();
    } catch (e) {
      error.value = toUserFacingError(e, fallbackError);
      throw e;
    } finally {
      busy.value = false;
    }
  }

  return { busy, error, run };
}
