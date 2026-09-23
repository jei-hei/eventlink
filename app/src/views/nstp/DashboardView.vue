<script setup lang="ts">
import { computed } from "vue";
import CampusCalendarOfficePage from "@/components/CampusCalendarOfficePage.vue";
import { mapPortalEventsToCalendar } from "@/composables/mapPortalEventsToCalendar";
import { useNstpPortal } from "./portalContext";
import { useDashboardLifecycleLog } from "@/composables/useDashboardLifecycleLog";

useDashboardLifecycleLog("nstp/DashboardView");

const { scheduledEvents } = useNstpPortal();
const calendarEvents = computed(() => mapPortalEventsToCalendar(scheduledEvents.value));
</script>

<template>
  <CampusCalendarOfficePage
    office-title="NSTP"
    office-lead="Review campus-wide scheduled events for NSTP coordination. This office does not approve requests — the calendar is the working view."
    :events="calendarEvents"
  />
</template>
