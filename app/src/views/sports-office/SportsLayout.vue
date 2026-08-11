<script setup lang="ts">
import { ref, provide } from "vue";
import { RouterView } from "vue-router";
import type { SportsEvent } from "./types";
import { sportsPortalKey } from "./portalContext";
import SportsSidebar from "./components/SportsSidebar.vue";
import PortalShell from "@/components/PortalShell.vue";
import { usePortalEvents } from "@/composables/usePortalEvents";

const sidebarOpen = ref(false);
const mockPending = ref<SportsEvent[]>([]);
const mockApproved = ref<SportsEvent[]>([]);

const { events, approvedEvents, scheduledEvents, handleApprove, handleReject, useDb } = usePortalEvents(
  "sports_office",
  { events: mockPending, approvedEvents: mockApproved },
);

provide(sportsPortalKey, { events, approvedEvents, scheduledEvents, handleApprove, handleReject, useDb });
</script>

<template>
  <PortalShell
    display-name="Sports Officer"
    role-title="Sports Office"
    email="sports@eventlink.local"
    department="Sports Office"
    @open-sidebar="sidebarOpen = true"
  >
    <template #sidebar>
      <SportsSidebar :open="sidebarOpen" @close="sidebarOpen = false" />
    </template>
    <RouterView />
  </PortalShell>
</template>
