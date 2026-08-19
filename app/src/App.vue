<script setup lang="ts">
import { onMounted, watch } from "vue";
import { RouterView } from "vue-router";
import PortalToastHost from "@/components/portal/PortalToastHost.vue";
import { useStudentRegistryStore } from "@/stores/studentRegistry";
import { usePageVisibility } from "@/composables/usePageVisibility";
import { useAuthStore } from "@/stores/auth";
import { useEventRequestsStore } from "@/stores/eventRequests";
import { useNotificationsStore } from "@/stores/notifications";
import { useUiStore } from "@/stores/ui";
import { isSupabaseConfigured } from "@/lib/supabase";

const auth = useAuthStore();
const events = useEventRequestsStore();
const notifications = useNotificationsStore();
const ui = useUiStore();
const { visible } = usePageVisibility();

let resumeBusy = false;
let lastResumeToastAt = 0;

onMounted(() => {
  const registry = useStudentRegistryStore();
  if (!registry.useSupabase) {
    registry.seedDemo();
  }
});

watch(visible, (isVisible) => {
  if (!isVisible || !isSupabaseConfigured || resumeBusy) return;
  resumeBusy = true;
  void (async () => {
    try {
      const sessionResult = await auth.revalidateSessionOnResume();
      if (!sessionResult.ok || !auth.isAuthenticated) return;

      let updated = false;
      try {
        if (auth.appRole === "student") {
          await events.loadForStudentDashboard(true);
          updated = true;
        } else if (auth.userId && auth.appRole) {
          updated = (await events.load(true)) || updated;
        }
      } catch {
        // Keep UI usable; next user action can retry.
      }

      try {
        await notifications.hydrate(true);
        updated = true;
      } catch {
        // best effort
      }

      const now = Date.now();
      if (updated && now - lastResumeToastAt > 8_000) {
        lastResumeToastAt = now;
        ui.pushToast("Data updated.", "Latest data loaded.", "info");
      }
    } finally {
      resumeBusy = false;
    }
  })();
});
</script>

<template>
  <RouterView />
  <PortalToastHost />
</template>

<style scoped></style>
