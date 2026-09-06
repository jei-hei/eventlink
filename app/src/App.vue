<script setup lang="ts">
import { watch } from "vue";
import { RouterView } from "vue-router";
import PortalToastHost from "@/components/portal/PortalToastHost.vue";
import { usePageVisibility } from "@/composables/usePageVisibility";
import { useAuthStore } from "@/stores/auth";
import { useEventRequestsStore } from "@/stores/eventRequests";
import { useNotificationsStore } from "@/stores/notifications";
import { useProfileStore } from "@/stores/profile";
import { useUiStore } from "@/stores/ui";
import { isSupabaseConfigured } from "@/lib/supabase";
import { appRoleToPortalRole } from "@/types/appRole";
import type { PortalRoleKey } from "@/types/portalProfile";

const auth = useAuthStore();
const events = useEventRequestsStore();
const notifications = useNotificationsStore();
const profile = useProfileStore();
const ui = useUiStore();
const { visible } = usePageVisibility();

let resumeBusy = false;
let lastResumeToastAt = 0;
let hiddenAt = Date.now();
const FORCE_AFTER_HIDDEN_MS = 30_000;

function portalRoleFromAuth(): PortalRoleKey | null {
  if (!auth.appRole) return null;
  return appRoleToPortalRole(auth.appRole);
}

watch(visible, (isVisible) => {
  if (!isVisible) {
    hiddenAt = Date.now();
    return;
  }
  if (!isSupabaseConfigured || resumeBusy) return;

  const hiddenFor = Date.now() - hiddenAt;
  const forceData = hiddenFor >= FORCE_AFTER_HIDDEN_MS;

  resumeBusy = true;
  void (async () => {
    try {
      const sessionResult = await auth.revalidateSessionOnResume();
      if (!sessionResult.ok || !auth.isAuthenticated) return;

      let updated = false;
      let failed = false;

      try {
        if (auth.userId && auth.appRole) {
          updated = (await events.load(forceData)) || updated;
        }
      } catch {
        failed = true;
      }

      try {
        await notifications.hydrate(forceData);
        updated = true;
      } catch {
        failed = true;
      }

      try {
        const portalRole = portalRoleFromAuth();
        if (auth.userId && portalRole) {
          await profile.ensureHydrated(portalRole);
        }
      } catch {
        // profile is best-effort on resume
      }

      const now = Date.now();
      if (failed && now - lastResumeToastAt > 8_000) {
        lastResumeToastAt = now;
        ui.pushToast(
          "Could not refresh data",
          "Connection may be slow. Retry by switching tabs again or continue working.",
          "error",
        );
      } else if (updated && forceData && now - lastResumeToastAt > 8_000) {
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
