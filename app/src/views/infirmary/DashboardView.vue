<script setup lang="ts">
import { computed } from "vue";
import { Calendar } from "lucide-vue-next";
import ScheduledEventsCalendar from "@/components/ScheduledEventsCalendar.vue";
import { mapPortalEventsToCalendar } from "@/composables/mapPortalEventsToCalendar";
import { useInfirmaryPortal } from "./portalContext";
import { useDashboardLifecycleLog } from "@/composables/useDashboardLifecycleLog";

useDashboardLifecycleLog("infirmary/DashboardView");

const { scheduledEvents } = useInfirmaryPortal();
const calendarEvents = computed(() => mapPortalEventsToCalendar(scheduledEvents.value));
</script>

<template>
  <div class="dash-page calendar-balanced-page">
    <div class="flex shrink-0 items-center gap-2">
      <Calendar :size="20" class="text-emerald-600" />
      <div>
        <h1 class="text-base font-bold text-gray-800">Campus event calendar</h1>
        <p class="text-xs text-gray-500">Infirmary · scheduled events campus-wide</p>
      </div>
    </div>
    <ScheduledEventsCalendar
      :events="calendarEvents"
      title="Scheduled events"
      list-layout="calendar-only"
      :upcoming-limit="6"
      class="w-full min-w-0"
    />
  </div>
</template>
