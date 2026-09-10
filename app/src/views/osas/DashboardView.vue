<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from "vue";
import { Calendar, CheckCircle, XCircle } from "lucide-vue-next";
import type { OsasEvent } from "./types";
import { useOsasPortal } from "./portalContext";
import ScheduledEventsCalendar from "@/components/ScheduledEventsCalendar.vue";
import { mapPortalEventsToCalendar } from "@/composables/mapPortalEventsToCalendar";
import { useEventsTableLoading } from "@/composables/useEventsTableLoading";
import PortalTableSkeleton from "@/components/portal/PortalTableSkeleton.vue";

const OsasEventDetailModal = defineAsyncComponent(
  () => import("./components/OsasEventDetailModal.vue"),
);

const { events, scheduledEvents, handleApprove, handleReject, handleRequestRevision, busy } = useOsasPortal();
const eventsLoading = useEventsTableLoading();

const selectedEvent = ref<OsasEvent | null>(null);

const pendingEvents = computed(() => events.value);

const pendingCount = computed(() => pendingEvents.value.length);

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
  <div class="dash-page !overflow-visible">
    <div class="dash-split !flex-none">
      <div class="flex min-w-0 flex-col">
        <div class="dash-card">
          <div class="px-4 py-3 border-b border-gray-200 flex items-center gap-2 flex-wrap shrink-0">
            <Calendar :size="18" class="text-[#16A34A]" />
            <h2 class="font-bold text-sm text-gray-800 uppercase tracking-wide">Pending Event Requests</h2>
            <span v-if="pendingCount > 0" class="bg-[#16A34A] text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {{ pendingCount }}
            </span>
          </div>

          <div class="w-full">
            <table class="w-full table-fixed">
              <colgroup>
                <col class="w-[8%]" />
                <col class="w-[14%]" />
                <col class="w-[16%]" />
                <col class="w-[16%]" />
                <col class="w-[12%]" />
                <col class="w-[10%]" />
                <col class="w-[10%]" />
                <col class="w-[14%]" />
              </colgroup>
              <thead class="hidden bg-gray-50 md:table-header-group">
                <tr>
                  <th
                    class="px-1.5 py-2.5 text-left font-bold border-r border-gray-200 text-xs text-gray-600 uppercase tracking-wide lg:px-2"
                  >
                    Type
                  </th>
                  <th
                    class="px-1.5 py-2.5 text-left font-bold border-r border-gray-200 text-xs text-gray-600 uppercase tracking-wide lg:px-2"
                  >
                    Organization
                  </th>
                  <th
                    class="px-1.5 py-2.5 text-left font-bold border-r border-gray-200 text-xs text-gray-600 uppercase tracking-wide lg:px-2"
                  >
                    Activity
                  </th>
                  <th
                    class="px-1.5 py-2.5 text-left font-bold border-r border-gray-200 text-xs text-gray-600 uppercase tracking-wide lg:px-2"
                  >
                    Date/Time
                  </th>
                  <th
                    class="px-1.5 py-2.5 text-left font-bold border-r border-gray-200 text-xs text-gray-600 uppercase tracking-wide lg:px-2"
                  >
                    Venue
                  </th>
                  <th
                    class="px-1.5 py-2.5 text-left font-bold border-r border-gray-200 text-xs text-gray-600 uppercase tracking-wide lg:px-2"
                  >
                    Participants
                  </th>
                  <th
                    class="px-1.5 py-2.5 text-left font-bold border-r border-gray-200 text-xs text-gray-600 uppercase tracking-wide lg:px-2"
                  >
                    SDG/s
                  </th>
                  <th class="px-1.5 py-2.5 text-left font-bold text-xs text-gray-600 uppercase tracking-wide lg:px-2">Actions</th>
                </tr>
              </thead>
              <tbody class="block md:table-row-group">
                <PortalTableSkeleton v-if="eventsLoading" :rows="5" :columns="8" />
                <tr
                  v-else
                  v-for="event in pendingEvents"
                  :key="event.id"
                  :class="[
                    'block border-b border-gray-100 px-3 py-2 hover:bg-gray-50 transition cursor-pointer md:table-row md:px-0 md:py-0',
                    event.status === 'Conflict' ? 'bg-amber-50' : '',
                  ]"
                  @click="selectedEvent = event"
                >
                  <td class="flex min-w-0 gap-3 border-gray-100 py-1.5 text-sm text-gray-600 md:table-cell md:border-r md:px-1.5 md:py-2.5 lg:px-2">
                    <span class="w-24 shrink-0 text-xs font-bold uppercase tracking-wide text-gray-500 md:hidden">Type</span>
                    <span class="min-w-0 flex-1">
                      <span
                        :class="[
                          'inline-block max-w-full break-words whitespace-normal rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                          event.eventType === 'SSC Event' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700',
                        ]"
                      >
                        {{ event.eventType === "SSC Event" ? "SSC" : "Org" }}
                      </span>
                    </span>
                  </td>
                  <td class="flex min-w-0 gap-3 border-gray-100 py-1.5 text-sm text-gray-600 md:table-cell md:border-r md:px-1.5 md:py-2.5 lg:px-2">
                    <span class="w-24 shrink-0 text-xs font-bold uppercase tracking-wide text-gray-500 md:hidden">Organization</span>
                    <span class="min-w-0 flex-1 break-words whitespace-normal">{{ event.organization }}</span>
                  </td>
                  <td class="flex min-w-0 gap-3 border-gray-100 py-1.5 text-sm font-medium text-gray-800 md:table-cell md:border-r md:px-1.5 md:py-2.5 lg:px-2">
                    <span class="w-24 shrink-0 text-xs font-bold uppercase tracking-wide text-gray-500 md:hidden">Activity</span>
                    <span class="min-w-0 flex-1 break-words whitespace-normal">{{ event.activity || event.name }}</span>
                  </td>
                  <td class="flex min-w-0 gap-3 border-gray-100 py-1.5 text-sm text-gray-600 md:table-cell md:border-r md:px-1.5 md:py-2.5 lg:px-2">
                    <span class="w-24 shrink-0 text-xs font-bold uppercase tracking-wide text-gray-500 md:hidden">Date/Time</span>
                    <span class="min-w-0 flex-1 break-words whitespace-normal">
                      <span class="block">{{ event.date }}</span>
                      <span v-if="event.startTime || event.endTime" class="mt-0.5 block text-xs text-gray-500">
                        {{
                          event.startTime && event.endTime
                            ? `${event.startTime} - ${event.endTime}`
                            : event.startTime || event.endTime
                        }}
                      </span>
                    </span>
                  </td>
                  <td class="flex min-w-0 gap-3 border-gray-100 py-1.5 text-sm text-gray-600 md:table-cell md:border-r md:px-1.5 md:py-2.5 lg:px-2">
                    <span class="w-24 shrink-0 text-xs font-bold uppercase tracking-wide text-gray-500 md:hidden">Venue</span>
                    <span class="min-w-0 flex-1 break-words whitespace-normal">{{ event.venue }}</span>
                  </td>
                  <td class="flex min-w-0 gap-3 border-gray-100 py-1.5 text-sm text-gray-600 md:table-cell md:border-r md:px-1.5 md:py-2.5 lg:px-2">
                    <span class="w-24 shrink-0 text-xs font-bold uppercase tracking-wide text-gray-500 md:hidden">Participants</span>
                    <span class="min-w-0 flex-1 break-words whitespace-normal">{{ event.participants ?? "—" }}</span>
                  </td>
                  <td class="flex min-w-0 gap-3 border-gray-100 py-1.5 text-sm text-gray-600 md:table-cell md:border-r md:px-1.5 md:py-2.5 lg:px-2">
                    <span class="w-24 shrink-0 text-xs font-bold uppercase tracking-wide text-gray-500 md:hidden">SDG/s</span>
                    <span class="min-w-0 flex-1 break-words whitespace-normal">{{ event.sdgs ?? "—" }}</span>
                  </td>
                  <td class="flex min-w-0 gap-3 py-1.5 md:table-cell md:px-1.5 md:py-2.5 lg:px-2">
                    <span class="w-24 shrink-0 text-xs font-bold uppercase tracking-wide text-gray-500 md:hidden">Actions</span>
                    <div class="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                      <button
                        type="button"
                        class="flex max-w-full items-center gap-1 rounded-lg bg-[#4ADE80] px-2 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-[#3BC56D] disabled:opacity-60"
                        :disabled="busy"
                        @click.stop="handleApprove(event.id)"
                      >
                        <CheckCircle :size="12" />
                        APPROVE
                      </button>
                      <button
                        type="button"
                        class="flex max-w-full items-center gap-1 rounded-lg bg-[#DC2626] px-2 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-[#B91C1C] disabled:opacity-60"
                        :disabled="busy"
                        @click.stop="handleReject(event.id)"
                      >
                        <XCircle :size="12" />
                        REJECT
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!eventsLoading && pendingEvents.length === 0" class="block md:table-row">
                  <td colspan="8" class="block py-12 text-center text-sm text-gray-400 md:table-cell">No pending event requests</td>
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

    <OsasEventDetailModal
      v-if="selectedEvent"
      :event="selectedEvent"
      @close="selectedEvent = null"
      @approve="onModalApprove"
      @reject="onModalReject"
      @request-revision="onModalRevision"
    />
  </div>
</template>
