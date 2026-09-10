import { onMounted, onUnmounted } from "vue";

/** Temporary diagnostics: confirms whether tab-return remounts the dashboard. */
export function useDashboardLifecycleLog(viewName: string) {
  onMounted(() => {
    console.info(`[EventLink] ${viewName} mounted`, {
      path: typeof window !== "undefined" ? window.location.pathname : "",
      visibility: typeof document !== "undefined" ? document.visibilityState : "unknown",
    });
  });
  onUnmounted(() => {
    console.info(`[EventLink] ${viewName} unmounted`, {
      path: typeof window !== "undefined" ? window.location.pathname : "",
      visibility: typeof document !== "undefined" ? document.visibilityState : "unknown",
    });
  });
}
