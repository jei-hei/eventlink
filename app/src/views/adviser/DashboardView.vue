<script setup lang="ts">
import { computed, ref } from "vue";
import { Calendar, Check, XCircle } from "lucide-vue-next";
import type { AdviserEvent } from "./types";
import { useAdviserPortal } from "./portalContext";
import AdviserEventDetailModal from "./components/AdviserEventDetailModal.vue";
import ScheduledEventsCalendar from "@/components/ScheduledEventsCalendar.vue";
import { mapPortalEventsToCalendar } from "@/composables/mapPortalEventsToCalendar";
import { useEventsTableLoading } from "@/composables/useEventsTableLoading";
import PortalTableSkeleton from "@/components/portal/PortalTableSkeleton.vue";

const { events, scheduledEvents, handleApprove, handleReject, handleRequestRevision } = useAdviserPortal();
const eventsLoading = useEventsTableLoading();

const selectedEvent = ref<AdviserEvent | null>(null);

const pendingCount = computed(() => events.value.filter((e) => e.status === "Pending").length);

const calendarEvents = computed(() => mapPortalEventsToCalendar(scheduledEvents.value));

function onModalApprove() {
  if (!selectedEvent.value) return;
  handleApprove(selectedEvent.value.id);
  selectedEvent.value = null;
}

function onModalReject() {
  if (!selectedEvent.value) return;
  handleReject(selectedEvent.value.id);
  selectedEvent.value = null;
}

async function onModalRevision(comment: string, attachmentFile: File | null) {
  if (!selectedEvent.value) return;
  await handleRequestRevision(selectedEvent.value.id, comment, attachmentFile);
  selectedEvent.value = null;
}
</script>

<template>
  <div class="dash-page">
    <div class="dash-split">
      <div class="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-[0_0_68%]">
        <div class="dash-card flex min-h-[min(220px,45vh)] flex-1 flex-col">
          <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2.5 sm:px-4">
            <Calendar :size="18" class="text-emerald-600" />
            <h2 class="text-xs font-bold uppercase tracking-wide text-slate-800 sm:text-sm">Pending Events Table</h2>
            <span
              v-if="pendingCount > 0"
              class="rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-2 py-0.5 text-xs font-bold text-white shadow-sm"
            >
              {{ pendingCount }}
            </span>
          </div>

          <div class="min-h-0 flex-1 overflow-auto">
            <table class="w-full min-w-[32rem] text-left sm:min-w-0">
              <thead class="sticky top-0 z-10 bg-slate-50">
                <tr>
                  <th
                    class="border-r border-slate-200 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600"
                  >
                    Organization
                  </th>
                  <th
                    class="border-r border-slate-200 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600"
                  >
                    Activity
                  </th>
                  <th
                    class="border-r border-slate-200 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600"
                  >
                    Date/Time
                  </th>
                  <th
                    class="border-r border-slate-200 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600"
                  >
                    Venue
                  </th>
                  <th
                    class="border-r border-slate-200 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600"
                  >
                    Participants
                  </th>
                  <th
                    class="border-r border-slate-200 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600"
                  >
                    SDG/s
                  </th>
                  <th
                    class="sticky right-0 z-20 min-w-[9rem] bg-slate-50 px-3 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-slate-600 shadow-[-6px_0_10px_-6px_rgba(15,23,42,0.2)]"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                <PortalTableSkeleton v-if="eventsLoading" :rows="5" :columns="7" />
                <tr
                  v-else
                  v-for="event in events"
                  :key="event.id"
                  class="cursor-pointer border-b border-slate-100 transition hover:bg-emerald-50/50"
                  @click="selectedEvent = event"
                >
                  <td class="border-r border-slate-100 px-3 py-2.5 text-sm text-slate-800">{{ event.organization }}</td>
                  <td class="border-r border-slate-100 px-3 py-2.5 text-sm font-medium text-slate-800">{{ event.name }}</td>
                  <td class="border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600">
                    {{ event.date }}
                    <span v-if="event.startTime"> - {{ event.startTime }}</span>
                  </td>
                  <td class="border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600">{{ event.venue }}</td>
                  <td class="border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600">{{ event.participants || "N/A" }}</td>
                  <td class="max-w-[150px] truncate border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600" :title="event.sdgs">
                    {{ event.sdgs || "N/A" }}
                  </td>
                  <td
                    class="sticky right-0 z-10 bg-white/95 px-2 py-2 text-center shadow-[-6px_0_10px_-6px_rgba(15,23,42,0.15)] sm:px-3"
                    @click.stop
                  >
                    <div class="flex flex-col items-stretch justify-center gap-1.5 sm:flex-row sm:flex-wrap sm:justify-center">
                      <button
                        type="button"
                        class="inline-flex items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-700 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:from-emerald-500 hover:to-teal-600 sm:text-xs"
                        @click="handleApprove(event.id)"
                      >
                        <Check :size="14" />
                        Approve
                      </button>
                      <button
                        type="button"
                        class="inline-flex items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-red-600 to-red-700 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:from-red-500 hover:to-red-600 sm:text-xs"
                        @click="handleReject(event.id)"
                      >
                        <XCircle :size="14" />
                        Decline
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!eventsLoading && events.length === 0">
                  <td colspan="7" class="py-10 text-center text-sm text-slate-400">No pending events</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="flex min-h-0 min-w-0 flex-col lg:flex-[0_0_32%]">
        <ScheduledEventsCalendar :events="calendarEvents" class="min-h-0" />
      </div>
    </div>

    <AdviserEventDetailModal
      v-if="selectedEvent"
      :event="selectedEvent"
      @close="selectedEvent = null"
      @approve="onModalApprove"
      @reject="onModalReject"
      @request-revision="onModalRevision"
    />
  </div>
</template>
