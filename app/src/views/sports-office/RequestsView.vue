<script setup lang="ts">
import ResourceOfficeDashboard from "@/components/portal/ResourceOfficeDashboard.vue";
import { useSportsPortal } from "./portalContext";

const { events, scheduledEvents, handleApprove, handleReject } = useSportsPortal();
</script>

<template>
  <ResourceOfficeDashboard
    office="sports_office"
    title="Sports venue requests"
    :events="events"
    :scheduled-events="scheduledEvents"
    @approve="handleApprove"
    @reject="handleReject"
  />
</template>
