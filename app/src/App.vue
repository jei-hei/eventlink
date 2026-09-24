<script setup lang="ts">
import { watch } from "vue";
import { RouterView } from "vue-router";
import PortalToastHost from "@/components/portal/PortalToastHost.vue";
import { usePageVisibility } from "@/composables/usePageVisibility";
import { useAuthStore } from "@/stores/auth";
import { useNotificationsStore } from "@/stores/notifications";
import { isSupabaseConfigured } from "@/lib/supabase";

const auth = useAuthStore();
const notifications = useNotificationsStore();
const { visible } = usePageVisibility();

watch(
  () => Boolean(auth.ready && auth.userId && auth.appRole),
  (ok) => {
    if (!ok || !isSupabaseConfigured) return;
    void notifications.hydrate(false);
  },
  { immediate: true },
);

watch(visible, (isVisible) => {
  if (!isVisible) {
    auth.pauseSingleSessionPolling();
    return;
  }
  auth.onTabBecameVisible();
});
</script>

<template>
  <!-- Splash is an overlay only. Never v-if <RouterView> on auth/idle state. -->
  <div v-if="!auth.ready" class="el-boot" aria-busy="true">
    <span>Loading EventLink…</span>
  </div>
  <div
    v-if="auth.inactivityWarning && auth.isAuthenticated"
    class="el-idle-warning"
    role="status"
  >
    You will be signed out in {{ auth.inactivityWarningSeconds }}s due to inactivity.
  </div>
  <RouterView />
  <PortalToastHost />
</template>

<style scoped>
.el-boot {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #020617;
  color: #ecfdf5;
  font-family: system-ui, sans-serif;
}
.el-boot span {
  font-size: 0.95rem;
  letter-spacing: 0.04em;
  opacity: 0.85;
}
.el-idle-warning {
  position: fixed;
  top: 0.75rem;
  left: 50%;
  z-index: 70;
  max-width: min(28rem, calc(100vw - 1.5rem));
  transform: translateX(-50%);
  border-radius: 0.75rem;
  border: 1px solid #fbbf24;
  background: #fffbeb;
  padding: 0.65rem 1rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #92400e;
  box-shadow: 0 10px 24px rgb(15 23 42 / 0.12);
}
</style>
