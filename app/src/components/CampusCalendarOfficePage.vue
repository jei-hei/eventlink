<script setup lang="ts">
import { computed } from "vue";
import { CalendarDays } from "lucide-vue-next";
import ScheduledEventsCalendar, {
  type ScheduledCalendarEvent,
} from "@/components/ScheduledEventsCalendar.vue";

const props = defineProps<{
  officeTitle: string;
  officeLead: string;
  events: ScheduledCalendarEvent[];
  loading?: boolean;
}>();

const stats = computed(() => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let upcoming = 0;
  let thisMonth = 0;
  for (const event of props.events) {
    if (event.completed) continue;
    const raw = event.startDate || event.date;
    if (!raw) continue;
    const start = new Date(raw);
    if (Number.isNaN(start.getTime())) continue;
    start.setHours(0, 0, 0, 0);
    if (start >= now) upcoming += 1;
    if (start.getFullYear() === now.getFullYear() && start.getMonth() === now.getMonth()) {
      thisMonth += 1;
    }
  }
  return { upcoming, thisMonth, total: props.events.length };
});
</script>

<template>
  <div class="dash-page calendar-office-page">
    <section class="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <header class="dash-card border border-slate-200/90 px-4 py-4 sm:px-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">{{ officeTitle }}</p>
            <h1 class="mt-0.5 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <CalendarDays class="h-5 w-5 shrink-0 text-emerald-700" stroke-width="2" />
              Campus calendar
            </h1>
            <p class="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{{ officeLead }}</p>
          </div>
          <div class="grid grid-cols-3 gap-2 sm:min-w-[17rem]">
            <template v-if="loading">
              <div v-for="n in 3" :key="n" class="rounded-lg border border-slate-200 bg-white/80 px-2.5 py-2 text-center">
                <div class="mx-auto mb-1 h-6 w-8 animate-pulse rounded bg-slate-200" />
                <div class="mx-auto h-3 w-12 animate-pulse rounded bg-slate-200" />
              </div>
            </template>
            <template v-else>
            <div class="rounded-lg border border-slate-200 bg-white/80 px-2.5 py-2 text-center">
              <p class="text-lg font-semibold tabular-nums text-slate-900">{{ stats.thisMonth }}</p>
              <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">This month</p>
            </div>
            <div class="rounded-lg border border-slate-200 bg-white/80 px-2.5 py-2 text-center">
              <p class="text-lg font-semibold tabular-nums text-slate-900">{{ stats.upcoming }}</p>
              <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Upcoming</p>
            </div>
            <div class="rounded-lg border border-slate-200 bg-white/80 px-2.5 py-2 text-center">
              <p class="text-lg font-semibold tabular-nums text-slate-900">{{ stats.total }}</p>
              <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">On calendar</p>
            </div>
            </template>
          </div>
        </div>
      </header>

      <ScheduledEventsCalendar
        :events="events"
        title="Scheduled events"
        list-layout="calendar-only"
        :upcoming-limit="12"
        class="w-full min-w-0"
      />
    </section>
  </div>
</template>
