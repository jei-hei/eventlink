import { ref, watch, type Ref } from "vue";

/** Returns a ref updated `delayMs` after `source` stops changing. */
export function useDebouncedRef<T>(source: Ref<T>, delayMs = 300): Ref<T> {
  const debounced = ref(source.value) as Ref<T>;
  let timer: ReturnType<typeof setTimeout> | undefined;

  watch(
    source,
    (v) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        debounced.value = v;
        timer = undefined;
      }, delayMs);
    },
    { flush: "post", immediate: true },
  );

  return debounced;
}
