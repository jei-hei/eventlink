<script setup lang="ts">
import ResourceOfficeDashboard from "@/components/portal/ResourceOfficeDashboard.vue";
import { useDashboardLifecycleLog } from "@/composables/useDashboardLifecycleLog";
import { useEventRequestsStore } from "@/stores/eventRequests";
import { useItPortal } from "./portalContext";

useDashboardLifecycleLog("it-infrastructure/DashboardView");

const { events, scheduledEvents, handleApprove, handleReject, busy } = useItPortal();
const eventStore = useEventRequestsStore();
</script>

<template>
  <ResourceOfficeDashboard
    office="it_infrastructure"
    title="IT equipment requests"
    :events="events"
    :scheduled-events="scheduledEvents"
    :pending-count="eventStore.pendingActionCount"
    @approve="handleApprove"
    @reject="handleReject"
    :busy="busy"
  />
</template>
