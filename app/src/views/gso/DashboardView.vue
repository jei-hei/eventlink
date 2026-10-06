<script setup lang="ts">
import { computed } from "vue";
import { Calendar, CheckCircle, XCircle } from "lucide-vue-next";
import type { GsoEvent } from "./types";
import { useGsoPortal } from "./portalContext";
import { useEventRequestsStore } from "@/stores/eventRequests";
import ScheduledEventsCalendar from "@/components/ScheduledEventsCalendar.vue";
import { mapPortalEventsToCalendar } from "@/composables/mapPortalEventsToCalendar";
import { useEventsTableLoading } from "@/composables/useEventsTableLoading";
import PortalTableSkeleton from "@/components/portal/PortalTableSkeleton.vue";
import { useDashboardLifecycleLog } from "@/composables/useDashboardLifecycleLog";
import { useOfficeAssignmentColumns } from "@/composables/useOfficeAssignmentColumns";

useDashboardLifecycleLog("gso/DashboardView");

const { events, scheduledEvents, handleApprove, handleReject, busy } = useGsoPortal();
const eventsLoading = useEventsTableLoading();
const eventStore = useEventRequestsStore();

const gsoEvents = computed<GsoEvent[]>(() => events.value);

const pendingCount = computed(() => Math.max(eventStore.pendingActionCount, gsoEvents.value.length));

const calendarEvents = computed(() => mapPortalEventsToCalendar(scheduledEvents.value));

const {
  showVenueColumn,
  showEquipmentColumn,
  showNoteColumn,
  venueLabel,
  equipmentLabel,
  officeNote,
  isNoteExpanded,
  toggleNote,
} = useOfficeAssignmentColumns(() => "gso", gsoEvents);

const colCount = computed(
  () => 4 + Number(showVenueColumn.value) + Number(showEquipmentColumn.value) + Number(showNoteColumn.value),
);

</script>

<template>
  <div class="dash-page">
    <div class="dash-split">
      <div class="flex min-h-0 min-w-0 flex-col">
        <div class="dash-card dash-card-fill">
          <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2.5 sm:px-4">
            <Calendar :size="18" class="text-emerald-600" />
            <h2 class="text-xs font-bold uppercase tracking-wide text-slate-800 sm:text-sm">
              Events requiring venue / equipment
            </h2>
            <span
              v-if="pendingCount > 0"
              class="rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-2 py-0.5 text-xs font-bold text-white shadow-sm"
            >
              {{ pendingCount }}
            </span>
          </div>

          <div class="min-h-0 flex-1 overflow-auto">
            <table class="w-full min-w-[36rem] text-left sm:min-w-0">
              <thead class="sticky top-0 z-10 bg-slate-50">
                <tr>
                  <th class="border-r border-slate-200 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                    Activity
                  </th>
                  <th class="border-r border-slate-200 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                    Organization
                  </th>
                  <th class="border-r border-slate-200 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                    Date / time
                  </th>
                  <th v-if="showVenueColumn" class="border-r border-slate-200 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                    Venue
                  </th>
                  <th v-if="showEquipmentColumn" class="border-r border-slate-200 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                    Equipment
                  </th>
                  <th v-if="showNoteColumn" class="border-r border-slate-200 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                    EO note
                  </th>
                  <th
                    class="sticky right-0 z-20 min-w-[8.5rem] bg-slate-50 px-3 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-slate-600 shadow-[-6px_0_10px_-6px_rgba(15,23,42,0.2)]"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                <PortalTableSkeleton v-if="eventsLoading" :rows="5" :columns="colCount" />
                <tr
                  v-else
                  v-for="event in gsoEvents"
                  :key="event.id"
                  :class="[
                    'border-b border-slate-100 transition hover:bg-emerald-50/50',
                    event.status === 'Conflict' ? 'bg-amber-50/80' : '',
                  ]"
                >
                  <td class="border-r border-slate-100 px-3 py-2.5 text-sm font-medium text-slate-800">{{ event.name }}</td>
                  <td class="border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600">{{ event.organization }}</td>
                  <td class="border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600">
                    <div>{{ event.date }}</div>
                    <div v-if="event.startTime && event.endTime" class="text-xs text-slate-500">
                      {{ event.startTime }} – {{ event.endTime }}
                    </div>
                  </td>
                  <td v-if="showVenueColumn" class="border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600">{{ venueLabel(event) }}</td>
                  <td
                    v-if="showEquipmentColumn"
                    class="max-w-[14rem] truncate border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600"
                    :title="equipmentLabel(event)"
                  >
                    {{ equipmentLabel(event) }}
                  </td>
                  <td v-if="showNoteColumn" class="max-w-[16rem] border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600">
                    <template v-if="officeNote(event)">
                      <p :class="isNoteExpanded(event.id) ? 'whitespace-pre-line break-words' : 'truncate'" :title="officeNote(event)">
                        {{ officeNote(event) }}
                      </p>
                      <button
                        type="button"
                        class="mt-0.5 text-xs font-semibold text-emerald-700 hover:underline"
                        @click="toggleNote(event.id)"
                      >
                        {{ isNoteExpanded(event.id) ? "Show less" : "Show full note" }}
                      </button>
                    </template>
                    <span v-else>—</span>
                  </td>
                  <td
                    class="sticky right-0 z-10 bg-white/95 px-2 py-2 text-center shadow-[-6px_0_10px_-6px_rgba(15,23,42,0.15)] sm:px-3"
                  >
                    <div class="flex flex-col items-stretch gap-1.5 sm:flex-row sm:flex-wrap sm:justify-center">
                      <button
                        type="button"
                        class="inline-flex items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-700 px-2 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:from-emerald-500 hover:to-teal-600 disabled:opacity-60 sm:text-xs"
                        :disabled="busy"
                        @click="handleApprove(event.id)"
                      >
                        <CheckCircle :size="12" />
                        Approve
                      </button>
                      <button
                        type="button"
                        class="inline-flex items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-red-600 to-red-700 px-2 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:from-red-500 hover:to-red-600 disabled:opacity-60 sm:text-xs"
                        :disabled="busy"
                        @click="handleReject(event.id)"
                      >
                        <XCircle :size="12" />
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!eventsLoading && gsoEvents.length === 0">
                  <td :colspan="colCount" class="py-12 text-center text-sm text-slate-400">No events requiring venue or equipment</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="flex min-h-0 min-w-0 flex-col">
        <ScheduledEventsCalendar :events="calendarEvents" class="h-full min-h-0" />
      </div>
    </div>
  </div>
</template>
