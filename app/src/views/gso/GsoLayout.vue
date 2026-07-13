<script setup lang="ts">
import { ref, provide } from "vue";
import { RouterView } from "vue-router";
import type { GsoEvent } from "./types";
import { gsoPortalKey } from "./portalContext";
import GsoSidebar from "./components/GsoSidebar.vue";
import PortalShell from "@/components/PortalShell.vue";
import { usePortalEvents } from "@/composables/usePortalEvents";

const sidebarOpen = ref(false);

const mockPending = ref<GsoEvent[]>([]);
const mockApproved = ref<GsoEvent[]>([]);

const { events, approvedEvents, scheduledEvents, handleApprove, handleReject, handleCreateEvent, useDb } =
  usePortalEvents("gso", { events: mockPending, approvedEvents: mockApproved });

provide(gsoPortalKey, {
  events,
  approvedEvents,
  scheduledEvents,
  handleApprove,
  handleReject,
  handleCreateEvent,
  useDb,
});
</script>

<template>
  <PortalShell
    display-name="Juan Dela Cruz"
    role-title="GSO"
    email="juan.delacruz@isu.edu.ph"
    department="General Services Office"
    @open-sidebar="sidebarOpen = true"
  >
    <template #sidebar>
      <GsoSidebar :open="sidebarOpen" @close="sidebarOpen = false" />
    </template>
    <RouterView />
  </PortalShell>
</template>
