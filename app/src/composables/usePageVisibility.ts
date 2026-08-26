import { onMounted, onUnmounted, ref, type Ref } from "vue";

const visible: Ref<boolean> = ref(
  typeof document === "undefined" ? true : document.visibilityState !== "hidden",
);

let listenerCount = 0;

function sync() {
  visible.value = document.visibilityState !== "hidden";
}

/** Shared Page Visibility signal — one DOM listener for the whole app. */
export function usePageVisibility() {
  onMounted(() => {
    if (typeof document === "undefined") return;
    if (listenerCount === 0) {
      document.addEventListener("visibilitychange", sync);
      sync();
    }
    listenerCount += 1;
  });

  onUnmounted(() => {
    if (typeof document === "undefined") return;
    listenerCount = Math.max(0, listenerCount - 1);
    if (listenerCount === 0) {
      document.removeEventListener("visibilitychange", sync);
    }
  });

  return { visible };
}
