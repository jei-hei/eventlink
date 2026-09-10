<script setup lang="ts">
import ResourceOfficeDashboard from "@/components/portal/ResourceOfficeDashboard.vue";
import { useDashboardLifecycleLog } from "@/composables/useDashboardLifecycleLog";
import { useSportsPortal } from "./portalContext";

useDashboardLifecycleLog("sports-office/DashboardView");

const { events, scheduledEvents, handleApprove, handleReject, busy } = useSportsPortal();
</script>

<template>
  <ResourceOfficeDashboard
    office="sports_office"
    title="Venue requests"
    :events="events"
    :scheduled-events="scheduledEvents"
    @approve="handleApprove"
    @reject="handleReject"
    :busy="busy"
  />
</template>
