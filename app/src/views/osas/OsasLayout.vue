<script setup lang="ts">
import { ref, provide } from "vue";
import { RouterView } from "vue-router";
import type { OsasEvent } from "./types";
import { initialApprovedEvents, initialPendingEvents } from "./initialData";
import { osasPortalKey } from "./portalContext";
import OsasSidebar from "./components/OsasSidebar.vue";
import PortalShell from "@/components/PortalShell.vue";
import { usePortalEvents } from "@/composables/usePortalEvents";

const sidebarOpen = ref(false);

const mockPending = ref<OsasEvent[]>([...initialPendingEvents]);
const mockApproved = ref<OsasEvent[]>([...initialApprovedEvents]);

const { events, approvedEvents, scheduledEvents, handleApprove, handleReject, handleCreateEvent } =
  usePortalEvents("osas", { events: mockPending, approvedEvents: mockApproved });

provide(osasPortalKey, {
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
    role-title="OSAS"
    email="juan.delacruz@isu.edu.ph"
    department="Office of Student Affairs"
    @open-sidebar="sidebarOpen = true"
  >
    <template #sidebar>
      <OsasSidebar :open="sidebarOpen" @close="sidebarOpen = false" />
    </template>
    <RouterView />
  </PortalShell>
</template>
