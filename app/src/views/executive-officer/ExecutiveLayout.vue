<script setup lang="ts">
import { ref, provide } from "vue";
import { RouterView } from "vue-router";
import type { EoEvent } from "./types";
import { initialApprovedEvents, initialPendingEvents } from "./initialData";
import { executivePortalKey } from "./portalContext";
import ExecutiveSidebar from "./components/ExecutiveSidebar.vue";
import PortalShell from "@/components/PortalShell.vue";
import { usePortalEvents } from "@/composables/usePortalEvents";

const sidebarOpen = ref(false);

const mockPending = ref<EoEvent[]>([...initialPendingEvents]);
const mockApproved = ref<EoEvent[]>([...initialApprovedEvents]);

const {
  events,
  approvedEvents,
  scheduledEvents,
  handleApprove,
  handleReject,
  handleCreateEvent,
  handlePostEvent,
  handleUpdateEvent,
  submitRequest,
  useDb,
} = usePortalEvents("eo", { events: mockPending, approvedEvents: mockApproved }, { canPost: true });

provide(executivePortalKey, {
  events,
  approvedEvents,
  scheduledEvents,
  handleApprove,
  handleReject,
  handleCreateEvent,
  handlePostEvent,
  handleUpdateEvent,
  submitRequest,
  useDb,
});
</script>

<template>
  <PortalShell
    display-name="Juan Dela Cruz"
    role-title="Executive Officer"
    email="juan.delacruz@isu.edu.ph"
    department="Event Management"
    @open-sidebar="sidebarOpen = true"
  >
    <template #sidebar>
      <ExecutiveSidebar :open="sidebarOpen" @close="sidebarOpen = false" />
    </template>
    <RouterView />
  </PortalShell>
</template>
