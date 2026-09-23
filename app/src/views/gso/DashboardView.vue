<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from "vue";
import { Calendar, CheckCircle, XCircle } from "lucide-vue-next";
import type { GsoEvent } from "./types";
import { useGsoPortal } from "./portalContext";
import ScheduledEventsCalendar from "@/components/ScheduledEventsCalendar.vue";
import { mapPortalEventsToCalendar } from "@/composables/mapPortalEventsToCalendar";
import { useEventsTableLoading } from "@/composables/useEventsTableLoading";
import PortalTableSkeleton from "@/components/portal/PortalTableSkeleton.vue";
import { useDashboardLifecycleLog } from "@/composables/useDashboardLifecycleLog";
import { isProposalReviewed, PROPOSAL_REVIEW_HINT } from "@/utils/proposalReview";

useDashboardLifecycleLog("gso/DashboardView");

const GsoEventDetailModal = defineAsyncComponent(
  () => import("./components/GsoEventDetailModal.vue"),
);

const { events, scheduledEvents, handleApprove, handleReject, busy } = useGsoPortal();
const eventsLoading = useEventsTableLoading();

const selectedEvent = ref<GsoEvent | null>(null);

function gsoAssignments(event: GsoEvent) {
  return (event.resourceAssignments ?? []).filter(
    (a) => a.assignedOffice === "gso" && a.status === "pending",
  );
}

const gsoEvents = computed(() => events.value);

const pendingCount = computed(() => gsoEvents.value.length);

const calendarEvents = computed(() => mapPortalEventsToCalendar(scheduledEvents.value));

function venueLabel(event: GsoEvent) {
  const venues = gsoAssignments(event)
    .filter((a) => a.resourceKind === "venue")
    .map((a) => a.resourceName);
  if (venues.length) return venues.join(", ");
  return event.venue || "—";
}

function equipmentLabel(event: GsoEvent) {
  const equipment = gsoAssignments(event)
    .filter((a) => a.resourceKind === "equipment")
    .map((a) => `${a.resourceName} (x${a.quantity})`);
  if (equipment.length) return equipment.join(", ");
  return event.itemsEquipment || "N/A";
}

function onApprove(event: GsoEvent) {
  handleApprove(event.id);
}

function onModalApprove() {
  if (!selectedEvent.value) return;
  if (!handleApprove(selectedEvent.value.id)) return;
  selectedEvent.value = null;
}

function onModalReject() {
  if (!selectedEvent.value) return;
  handleReject(selectedEvent.value.id);
  selectedEvent.value = null;
}
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
                  <th class="border-r border-slate-200 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                    Venue
                  </th>
                  <th class="border-r border-slate-200 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                    Equipment
                  </th>
                  <th
                    class="sticky right-0 z-20 min-w-[8.5rem] bg-slate-50 px-3 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-slate-600 shadow-[-6px_0_10px_-6px_rgba(15,23,42,0.2)]"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                <PortalTableSkeleton v-if="eventsLoading" :rows="5" :columns="6" />
                <tr
                  v-else
                  v-for="event in gsoEvents"
                  :key="event.id"
                  :class="[
                    'cursor-pointer border-b border-slate-100 transition hover:bg-emerald-50/50',
                    event.status === 'Conflict' ? 'bg-amber-50/80' : '',
                  ]"
                  @click="selectedEvent = event"
                >
                  <td class="border-r border-slate-100 px-3 py-2.5 text-sm font-medium text-slate-800">{{ event.name }}</td>
                  <td class="border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600">{{ event.organization }}</td>
                  <td class="border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600">
                    <div>{{ event.date }}</div>
                    <div v-if="event.startTime && event.endTime" class="text-xs text-slate-500">
                      {{ event.startTime }} – {{ event.endTime }}
                    </div>
                  </td>
                  <td class="border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600">{{ venueLabel(event) }}</td>
                  <td
                    class="max-w-[14rem] truncate border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600"
                    :title="equipmentLabel(event)"
                  >
                    {{ equipmentLabel(event) }}
                  </td>
                  <td
                    class="sticky right-0 z-10 bg-white/95 px-2 py-2 text-center shadow-[-6px_0_10px_-6px_rgba(15,23,42,0.15)] sm:px-3"
                    @click.stop
                  >
                    <div class="flex flex-col items-stretch gap-1.5 sm:flex-row sm:flex-wrap sm:justify-center">
                      <button
                        type="button"
                        class="inline-flex items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-700 px-2 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:from-emerald-500 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-60 sm:text-xs"
                        :disabled="busy || !isProposalReviewed(event.letterPath)"
                        :title="isProposalReviewed(event.letterPath) ? '' : PROPOSAL_REVIEW_HINT"
                        @click="onApprove(event)"
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
                  <td colspan="6" class="py-12 text-center text-sm text-slate-400">No events requiring venue or equipment</td>
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

    <GsoEventDetailModal
      v-if="selectedEvent"
      :event="selectedEvent"
      @close="selectedEvent = null"
      @approve="onModalApprove"
      @reject="onModalReject"
    />
  </div>
</template>
