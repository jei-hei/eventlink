<script setup lang="ts">
import { computed } from "vue";
import CampusCalendarOfficePage from "@/components/CampusCalendarOfficePage.vue";
import { mapPortalEventsToCalendar } from "@/composables/mapPortalEventsToCalendar";
import { useInfirmaryPortal } from "./portalContext";
import { useEventsTableLoading } from "@/composables/useEventsTableLoading";
import { useDashboardLifecycleLog } from "@/composables/useDashboardLifecycleLog";

useDashboardLifecycleLog("infirmary/DashboardView");

const { scheduledEvents } = useInfirmaryPortal();
const calendarEvents = computed(() => mapPortalEventsToCalendar(scheduledEvents.value));
const eventsLoading = useEventsTableLoading();
</script>

<template>
  <CampusCalendarOfficePage
    office-title="Infirmary"
    office-lead="Review campus-wide scheduled events so medical coverage can be planned. This office does not approve requests — the calendar is the working view."
    :events="calendarEvents"
    :loading="eventsLoading"
  />
</template>
