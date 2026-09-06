<script setup lang="ts">
import { computed } from "vue";
import { Calendar } from "lucide-vue-next";
import ScheduledEventsCalendar from "@/components/ScheduledEventsCalendar.vue";
import { mapPortalEventsToCalendar } from "@/composables/mapPortalEventsToCalendar";
import { useNstpPortal } from "./portalContext";

const { scheduledEvents } = useNstpPortal();
const calendarEvents = computed(() => mapPortalEventsToCalendar(scheduledEvents.value));
</script>

<template>
  <div class="dash-page dash-page-fill">
    <div class="flex shrink-0 items-center gap-2">
      <Calendar :size="20" class="text-emerald-600" />
      <div>
        <h1 class="text-base font-bold text-gray-800">Campus event calendar</h1>
        <p class="text-xs text-gray-500">NSTP · scheduled events campus-wide</p>
      </div>
    </div>
    <ScheduledEventsCalendar :events="calendarEvents" title="Scheduled events" class="h-full min-h-0 flex-1" />
  </div>
</template>
