import { onMounted, onUnmounted, ref } from "vue";

/** True when the document tab is visible (Page Visibility API). */
export function usePageVisibility() {
  const visible = ref(
    typeof document === "undefined" ? true : document.visibilityState !== "hidden",
  );

  function sync() {
    visible.value = document.visibilityState !== "hidden";
  }

  onMounted(() => {
    document.addEventListener("visibilitychange", sync);
  });
  onUnmounted(() => {
    document.removeEventListener("visibilitychange", sync);
  });

  return { visible };
}
