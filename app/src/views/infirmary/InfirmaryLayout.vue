<script setup lang="ts">
import { ref, provide } from "vue";
import { RouterView } from "vue-router";
import { infirmaryPortalKey } from "./portalContext";
import InfirmarySidebar from "./components/InfirmarySidebar.vue";
import PortalShell from "@/components/PortalShell.vue";
import { usePortalEvents } from "@/composables/usePortalEvents";

const sidebarOpen = ref(false);

const mockPending = ref([]);
const mockApproved = ref([]);

const { scheduledEvents } = usePortalEvents("infirmary", {
  events: mockPending,
  approvedEvents: mockApproved,
});

provide(infirmaryPortalKey, { scheduledEvents });
</script>

<template>
  <PortalShell @open-sidebar="sidebarOpen = true">
    <template #sidebar>
      <InfirmarySidebar :open="sidebarOpen" @close="sidebarOpen = false" />
    </template>
    <RouterView />
  </PortalShell>
</template>
