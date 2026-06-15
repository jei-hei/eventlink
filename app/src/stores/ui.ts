import { defineStore } from "pinia";
import { ref } from "vue";

export type ToastVariant = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

let toastSeq = 0;

export const useUiStore = defineStore("ui", () => {
  const toasts = ref<ToastItem[]>([]);

  function pushToast(title: string, description?: string, variant: ToastVariant = "info") {
    const id = ++toastSeq;
    toasts.value = [...toasts.value, { id, title, description, variant }];
    window.setTimeout(() => dismissToast(id), 4500);
  }

  function dismissToast(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return { toasts, pushToast, dismissToast };
});
