<script setup lang="ts">
import { ref, provide } from "vue";
import { RouterView } from "vue-router";
import type { ItEvent } from "./types";
import { itPortalKey } from "./portalContext";
import ItSidebar from "./components/ItSidebar.vue";
import PortalShell from "@/components/PortalShell.vue";
import { usePortalEvents } from "@/composables/usePortalEvents";

const sidebarOpen = ref(false);
const mockPending = ref<ItEvent[]>([]);
const mockApproved = ref<ItEvent[]>([]);

const { events, approvedEvents, scheduledEvents, handleApprove, handleReject, useDb } = usePortalEvents(
  "it_infrastructure",
  { events: mockPending, approvedEvents: mockApproved },
);

provide(itPortalKey, { events, approvedEvents, scheduledEvents, handleApprove, handleReject, useDb });
</script>

<template>
  <PortalShell
    @open-sidebar="sidebarOpen = true"
  >
    <template #sidebar>
      <ItSidebar :open="sidebarOpen" @close="sidebarOpen = false" />
    </template>
    <RouterView />
  </PortalShell>
</template>
