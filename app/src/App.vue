<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { RouterView } from "vue-router";
import PortalToastHost from "@/components/portal/PortalToastHost.vue";
import { useStudentRegistryStore } from "@/stores/studentRegistry";
import { usePageVisibility } from "@/composables/usePageVisibility";
import { useAuthStore } from "@/stores/auth";
import { useEventRequestsStore } from "@/stores/eventRequests";
import { useNotificationsStore } from "@/stores/notifications";
import { useProfileStore } from "@/stores/profile";
import { useUiStore } from "@/stores/ui";
import { isSupabaseConfigured } from "@/lib/supabase";
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

function portalRoleFromAuth(): PortalRoleKey {
  const r = auth.appRole;
  if (r === "student_officer") return "student-officer";
  if (r === "it_infrastructure") return "it-infrastructure";
  if (r === "sports_office") return "sports-office";
  if (
    r === "student" ||
    r === "ssc" ||
    r === "adviser" ||
    r === "dean" ||
    r === "osas" ||
    r === "eo" ||
    r === "gso" ||
    r === "admin"
  ) {
    return r;
  }
  return "student";
}

onMounted(() => {
  const registry = useStudentRegistryStore();
  if (!registry.useSupabase) {
    registry.seedDemo();
  }
});

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
        if (auth.appRole === "student") {
          await events.loadForStudentDashboard(forceData);
          updated = true;
        } else if (auth.userId && auth.appRole) {
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
        if (auth.userId && auth.appRole) {
          await profile.ensureHydrated(portalRoleFromAuth());
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
