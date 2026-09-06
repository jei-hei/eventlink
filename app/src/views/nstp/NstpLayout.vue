<script setup lang="ts">
import { ref, provide } from "vue";
import { RouterView } from "vue-router";
import { nstpPortalKey } from "./portalContext";
import NstpSidebar from "./components/NstpSidebar.vue";
import PortalShell from "@/components/PortalShell.vue";
import { usePortalEvents } from "@/composables/usePortalEvents";

const sidebarOpen = ref(false);

const mockPending = ref([]);
const mockApproved = ref([]);

const { scheduledEvents } = usePortalEvents("nstp", {
  events: mockPending,
  approvedEvents: mockApproved,
});

provide(nstpPortalKey, { scheduledEvents });
</script>

<template>
  <PortalShell @open-sidebar="sidebarOpen = true">
    <template #sidebar>
      <NstpSidebar :open="sidebarOpen" @close="sidebarOpen = false" />
    </template>
    <RouterView />
  </PortalShell>
</template>
