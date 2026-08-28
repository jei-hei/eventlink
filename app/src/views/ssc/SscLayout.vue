<script setup lang="ts">
import { ref, provide } from "vue";
import { RouterView } from "vue-router";
import type { SscEvent } from "./types";
import { sscPortalKey } from "./portalContext";
import SscSidebar from "./components/SscSidebar.vue";
import PortalShell from "@/components/PortalShell.vue";
import { usePortalEvents } from "@/composables/usePortalEvents";
import { studentPostPublishKey } from "@/composables/studentPostPublishKey";

const sidebarOpen = ref(false);

const mockPending = ref<SscEvent[]>([]);
const mockApproved = ref<SscEvent[]>([]);

const portal = usePortalEvents("ssc", { events: mockPending, approvedEvents: mockApproved });
const {
  events,
  approvedEvents,
  declinedEvents,
  scheduledEvents,
  handleApprove,
  handleReject,
  handleCreateEvent,
  handlePostEvent,
  handleCreateFeedPost,
  handleResubmitDeclined,
} = portal;

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

provide(studentPostPublishKey, handleCreateFeedPost);

provide(sscPortalKey, {
  events,
  approvedEvents,
  declinedEvents,
  scheduledEvents,
  handleApprove,
  handleReject,
  handleCreateEvent,
  handlePostEvent,
  handleCreateFeedPost,
  handleResubmitDeclined,
  submitRequest: portal.submitRequest,
  useDb: portal.useDb,
  pushToast,
});
</script>

<template>
  <div>
    <PortalShell @open-sidebar="sidebarOpen = true">
      <template #sidebar>
        <SscSidebar :open="sidebarOpen" @close="sidebarOpen = false" />
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
  </div>
</template>
