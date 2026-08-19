<script setup lang="ts">
import ResourceOfficeDashboard from "@/components/portal/ResourceOfficeDashboard.vue";
import { useItPortal } from "./portalContext";

const { events, scheduledEvents, handleApprove, handleReject } = useItPortal();
</script>

<template>
  <ResourceOfficeDashboard
    office="it_infrastructure"
    title="IT equipment requests"
    :events="events"
    :scheduled-events="scheduledEvents"
    @approve="handleApprove"
    @reject="handleReject"
  />
</template>
