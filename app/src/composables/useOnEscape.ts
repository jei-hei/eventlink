import { onMounted, onUnmounted, watch, type Ref } from "vue";

function setBodyScrollLock(locked: boolean) {
  if (locked) document.documentElement.classList.add("overflow-hidden");
  else document.documentElement.classList.remove("overflow-hidden");
}

/** Calls `fn` when Escape is pressed while `active` is true; locks body scroll while active. */
export function useOnEscape(active: Ref<boolean>, fn: () => void) {
  function onKey(e: KeyboardEvent) {
    if (e.key !== "Escape" || !active.value) return;
    e.preventDefault();
    fn();
  }

  onMounted(() => window.addEventListener("keydown", onKey));
  onUnmounted(() => {
    window.removeEventListener("keydown", onKey);
    setBodyScrollLock(false);
  });

  watch(
    active,
    (on) => {
      setBodyScrollLock(on);
    },
    { immediate: true },
  );
}
