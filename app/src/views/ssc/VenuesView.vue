<script setup lang="ts">
import { computed } from "vue";
import ResourceOfficeDashboard from "@/components/portal/ResourceOfficeDashboard.vue";
import ResourceVenueManager from "@/components/portal/ResourceVenueManager.vue";
import { useSscPortal } from "./portalContext";
import { filterResourceOfficePending } from "@/services/eventRequestsDb";
import { useEventRequestsStore } from "@/stores/eventRequests";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { PortalEvent } from "@/types/portalEvent";
import { mapRowToPortalEvent } from "@/services/eventRequestsDb";

const { handleApprove, handleReject, scheduledEvents, useDb } = useSscPortal();
const store = useEventRequestsStore();

const resourceEvents = computed<PortalEvent[]>(() => {
  if (!isSupabaseConfigured || !useDb?.value) return [];
  return filterResourceOfficePending(store.rows, "ssc").map((r) => mapRowToPortalEvent(r));
});
</script>

<template>
  <div class="space-y-8">
    <ResourceOfficeDashboard
      office="ssc"
      title="SSC-managed venue / equipment requests"
      :events="resourceEvents"
      :scheduled-events="scheduledEvents"
      @approve="handleApprove"
      @reject="handleReject"
    />
    <ResourceVenueManager office="ssc" title="SSC Venues" />
  </div>
</template>
