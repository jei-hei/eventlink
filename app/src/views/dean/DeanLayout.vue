<script setup lang="ts">
import { ref, provide } from "vue";
import { RouterView } from "vue-router";
import type { DeanEvent } from "./types";
import { deanPortalKey } from "./portalContext";
import DeanSidebar from "./components/DeanSidebar.vue";
import PortalShell from "@/components/PortalShell.vue";
import { usePortalEvents } from "@/composables/usePortalEvents";

const sidebarOpen = ref(false);

const mockPending = ref<DeanEvent[]>([]);
const mockApproved = ref<DeanEvent[]>([]);

const { events, approvedEvents, scheduledEvents, handleApprove, handleReject, handleRequestRevision, handleCreateEvent } =
  usePortalEvents("dean", { events: mockPending, approvedEvents: mockApproved });

provide(deanPortalKey, {
  events,
  approvedEvents,
  scheduledEvents,
  handleApprove,
  handleReject,
  handleRequestRevision,
  handleCreateEvent,
});
</script>

<template>
  <PortalShell
    @open-sidebar="sidebarOpen = true"
  >
    <template #sidebar>
      <DeanSidebar :open="sidebarOpen" @close="sidebarOpen = false" />
    </template>
    <RouterView />
  </PortalShell>
</template>
