<script setup lang="ts">
import { ref, provide } from "vue";
import { RouterView } from "vue-router";
import type { AdviserEvent } from "./types";
import { adviserPortalKey } from "./portalContext";
import AdviserSidebar from "./components/AdviserSidebar.vue";
import PortalShell from "@/components/PortalShell.vue";
import { usePortalEvents } from "@/composables/usePortalEvents";

const sidebarOpen = ref(false);

const mockPending = ref<AdviserEvent[]>([]);
const mockApproved = ref<AdviserEvent[]>([]);

const { events, approvedEvents, scheduledEvents, handleApprove, handleReject, handleCreateEvent } =
  usePortalEvents("adviser", { events: mockPending, approvedEvents: mockApproved });

provide(adviserPortalKey, {
  events,
  approvedEvents,
  scheduledEvents,
  handleApprove,
  handleReject,
  handleCreateEvent,
});
</script>

<template>
  <PortalShell
    display-name="Juan Dela Cruz"
    role-title="Adviser"
    email="juan.delacruz@isu.edu.ph"
    department="CCSICT"
    @open-sidebar="sidebarOpen = true"
  >
    <template #sidebar>
      <AdviserSidebar :open="sidebarOpen" @close="sidebarOpen = false" />
    </template>
    <RouterView />
  </PortalShell>
</template>
