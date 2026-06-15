import { onMounted, onUnmounted, type Ref } from "vue";

/** Closes menu/dropdown when user clicks outside `target`. */
export function useClickOutside(target: Ref<HTMLElement | null>, handler: () => void) {
  function onDoc(ev: MouseEvent | TouchEvent) {
    const el = target.value;
    const t = ev.target as Node | null;
    if (!el || !t || el.contains(t)) return;
    handler();
  }

  onMounted(() => {
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
  });
  onUnmounted(() => {
    document.removeEventListener("mousedown", onDoc);
    document.removeEventListener("touchstart", onDoc);
  });
}
