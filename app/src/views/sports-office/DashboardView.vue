<script setup lang="ts">
import ResourceOfficeDashboard from "@/components/portal/ResourceOfficeDashboard.vue";
import { useDashboardLifecycleLog } from "@/composables/useDashboardLifecycleLog";
import { useEventRequestsStore } from "@/stores/eventRequests";
import { useSportsPortal } from "./portalContext";

useDashboardLifecycleLog("sports-office/DashboardView");

const { events, scheduledEvents, handleApprove, handleReject, busy } = useSportsPortal();
const eventStore = useEventRequestsStore();
</script>

<template>
  <ResourceOfficeDashboard
    office="sports_office"
    title="Venue requests"
    :events="events"
    :scheduled-events="scheduledEvents"
    :pending-count="eventStore.pendingActionCount"
    @approve="handleApprove"
    @reject="handleReject"
    :busy="busy"
  />
</template>
