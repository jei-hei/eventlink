<script setup lang="ts">
import { ref, provide } from "vue";
import { RouterView } from "vue-router";
import type { DeanEvent } from "./types";
import { initialApprovedEvents, initialPendingEvents } from "./initialData";
import { deanPortalKey } from "./portalContext";
import DeanSidebar from "./components/DeanSidebar.vue";
import PortalShell from "@/components/PortalShell.vue";
import { usePortalEvents } from "@/composables/usePortalEvents";

const sidebarOpen = ref(false);

const mockPending = ref<DeanEvent[]>([...initialPendingEvents]);
const mockApproved = ref<DeanEvent[]>([...initialApprovedEvents]);

const { events, approvedEvents, scheduledEvents, handleApprove, handleReject, handleCreateEvent } =
  usePortalEvents("dean", { events: mockPending, approvedEvents: mockApproved });

provide(deanPortalKey, {
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
    role-title="Dean"
    email="juan.delacruz@isu.edu.ph"
    department="CCSICT"
    @open-sidebar="sidebarOpen = true"
  >
    <template #sidebar>
      <DeanSidebar :open="sidebarOpen" @close="sidebarOpen = false" />
    </template>
    <RouterView />
  </PortalShell>
</template>
