<script setup lang="ts">
import { ref, provide } from "vue";
import { RouterView } from "vue-router";
import type { OfficerEvent } from "./types";
import { officerPortalKey } from "./portalContext";
import OfficerSidebar from "./components/OfficerSidebar.vue";
import PortalShell from "@/components/PortalShell.vue";
import { usePortalEvents } from "@/composables/usePortalEvents";
import { studentPostPublishKey } from "@/composables/studentPostPublishKey";

const sidebarOpen = ref(false);

const mockPending = ref<OfficerEvent[]>([]);
const mockApproved = ref<OfficerEvent[]>([]);

const portal = usePortalEvents("student_officer", {
  events: mockPending,
  approvedEvents: mockApproved,
});

const toast = ref<{
  title: string;
  description?: string;
  variant: "success" | "error";
} | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;

function pushToast(title: string, description?: string, variant: "success" | "error" = "success") {
  if (toastTimer) clearTimeout(toastTimer);
  toast.value = { title, description, variant };
  toastTimer = setTimeout(() => {
    toast.value = null;
  }, 4000);
}

provide(studentPostPublishKey, portal.handleCreateFeedPost);

provide(officerPortalKey, {
  events: portal.events,
  approvedEvents: portal.approvedEvents,
  declinedEvents: portal.declinedEvents,
  scheduledEvents: portal.scheduledEvents,
  handleApprove: portal.handleApprove,
  handleReject: portal.handleReject,
  handleCreateEvent: portal.handleCreateEvent,
  handlePostEvent: portal.handlePostEvent,
  handleCreateFeedPost: portal.handleCreateFeedPost,
  handleResubmitDeclined: portal.handleResubmitDeclined,
  submitRequest: portal.submitRequest,
  useDb: portal.useDb,
  pushToast,
});
</script>

<template>
  <PortalShell
    @open-sidebar="sidebarOpen = true"
  >
    <template #sidebar>
      <OfficerSidebar :open="sidebarOpen" @close="sidebarOpen = false" />
    </template>
    <RouterView />
  </PortalShell>

  <Teleport to="body">
    <div
      v-if="toast"
      :class="[
        'fixed right-3 top-3 z-[100] max-w-[min(22rem,calc(100vw-1.5rem))] rounded-lg border px-4 py-3 text-sm shadow-xl sm:right-4 sm:top-4',
        toast.variant === 'success'
          ? 'border-emerald-200 bg-white text-slate-900'
          : 'border-red-200 bg-white text-slate-900',
      ]"
      role="status"
    >
      <p class="font-bold">{{ toast.title }}</p>
      <p v-if="toast.description" class="mt-1 text-xs text-slate-600">{{ toast.description }}</p>
    </div>
  </Teleport>
</template>
