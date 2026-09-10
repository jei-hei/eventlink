<script setup lang="ts">
import ResourceOfficeDashboard from "@/components/portal/ResourceOfficeDashboard.vue";
import { useDashboardLifecycleLog } from "@/composables/useDashboardLifecycleLog";
import { useItPortal } from "./portalContext";

useDashboardLifecycleLog("it-infrastructure/DashboardView");

const { events, scheduledEvents, handleApprove, handleReject, busy } = useItPortal();
</script>

<template>
  <ResourceOfficeDashboard
    office="it_infrastructure"
    title="IT equipment requests"
    :events="events"
    :scheduled-events="scheduledEvents"
    @approve="handleApprove"
    @reject="handleReject"
    :busy="busy"
  />
</template>
