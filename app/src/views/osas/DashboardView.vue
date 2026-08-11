<script setup lang="ts">
import { computed, ref } from "vue";
import { Calendar, CheckCircle, XCircle } from "lucide-vue-next";
import type { OsasEvent } from "./types";
import { useOsasPortal } from "./portalContext";
import OsasEventDetailModal from "./components/OsasEventDetailModal.vue";
import ScheduledEventsCalendar from "@/components/ScheduledEventsCalendar.vue";
import { mapPortalEventsToCalendar } from "@/composables/mapPortalEventsToCalendar";
import { useEventsTableLoading } from "@/composables/useEventsTableLoading";
import PortalTableSkeleton from "@/components/portal/PortalTableSkeleton.vue";

const { events, scheduledEvents, handleApprove, handleReject } = useOsasPortal();
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
</script>

<template>
  <div class="dash-page">
    <div class="dash-split">
      <div class="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-[0_0_68%]">
        <div class="dash-card flex min-h-[min(220px,45vh)] flex-1 flex-col">
          <div class="px-4 py-3 border-b border-gray-200 flex items-center gap-2 flex-wrap shrink-0">
            <Calendar :size="18" class="text-[#16A34A]" />
            <h2 class="font-bold text-sm text-gray-800 uppercase tracking-wide">Pending Event Requests</h2>
            <span v-if="pendingCount > 0" class="bg-[#16A34A] text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {{ pendingCount }}
            </span>
          </div>

          <div class="flex-1 overflow-auto min-h-0">
            <table class="w-full">
              <thead class="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th
                    class="px-3 py-2.5 text-left font-bold border-r border-gray-200 text-xs text-gray-600 uppercase tracking-wide"
                  >
                    Type
                  </th>
                  <th
                    class="px-3 py-2.5 text-left font-bold border-r border-gray-200 text-xs text-gray-600 uppercase tracking-wide"
                  >
                    Organization
                  </th>
                  <th
                    class="px-3 py-2.5 text-left font-bold border-r border-gray-200 text-xs text-gray-600 uppercase tracking-wide"
                  >
                    Activity
                  </th>
                  <th
                    class="px-3 py-2.5 text-left font-bold border-r border-gray-200 text-xs text-gray-600 uppercase tracking-wide"
                  >
                    Date/Time
                  </th>
                  <th
                    class="px-3 py-2.5 text-left font-bold border-r border-gray-200 text-xs text-gray-600 uppercase tracking-wide"
                  >
                    Venue
                  </th>
                  <th
                    class="px-3 py-2.5 text-left font-bold border-r border-gray-200 text-xs text-gray-600 uppercase tracking-wide"
                  >
                    Participants
                  </th>
                  <th
                    class="px-3 py-2.5 text-left font-bold border-r border-gray-200 text-xs text-gray-600 uppercase tracking-wide"
                  >
                    SDG/s
                  </th>
                  <th class="px-3 py-2.5 text-left font-bold text-xs text-gray-600 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                <PortalTableSkeleton v-if="eventsLoading" :rows="5" :columns="8" />
                <tr
                  v-else
                  v-for="event in pendingEvents"
                  :key="event.id"
                  :class="[
                    'border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer',
                    event.status === 'Conflict' ? 'bg-amber-50' : '',
                  ]"
                  @click="selectedEvent = event"
                >
                  <td class="px-3 py-2.5 border-r border-gray-100 text-sm text-gray-600">
                    <span
                      :class="[
                        'inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                        event.eventType === 'SSC Event' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700',
                      ]"
                    >
                      {{ event.eventType === "SSC Event" ? "SSC" : "Org" }}
                    </span>
                  </td>
                  <td class="px-3 py-2.5 border-r border-gray-100 text-sm text-gray-600">{{ event.organization }}</td>
                  <td class="px-3 py-2.5 border-r border-gray-100 text-sm font-medium text-gray-800">
                    {{ event.activity || event.name }}
                  </td>
                  <td class="px-3 py-2.5 border-r border-gray-100 text-sm text-gray-600">
                    <div>{{ event.date }}</div>
                    <div v-if="event.startTime || event.endTime" class="text-xs text-gray-500 mt-0.5">
                      {{
                        event.startTime && event.endTime
                          ? `${event.startTime} - ${event.endTime}`
                          : event.startTime || event.endTime
                      }}
                    </div>
                  </td>
                  <td class="px-3 py-2.5 border-r border-gray-100 text-sm text-gray-600">{{ event.venue }}</td>
                  <td class="px-3 py-2.5 border-r border-gray-100 text-sm text-gray-600">{{ event.participants ?? "—" }}</td>
                  <td class="px-3 py-2.5 border-r border-gray-100 text-sm text-gray-600">{{ event.sdgs ?? "—" }}</td>
                  <td class="px-3 py-2.5">
                    <div class="flex gap-1.5">
                      <button
                        type="button"
                        class="bg-[#4ADE80] hover:bg-[#3BC56D] text-white px-2.5 py-1 rounded-lg font-semibold transition flex items-center gap-1 text-xs shadow-sm"
                        @click.stop="handleApprove(event.id)"
                      >
                        <CheckCircle :size="12" />
                        APPROVE
                      </button>
                      <button
                        type="button"
                        class="bg-[#DC2626] hover:bg-[#B91C1C] text-white px-2.5 py-1 rounded-lg font-semibold transition flex items-center gap-1 text-xs shadow-sm"
                        @click.stop="handleReject(event.id)"
                      >
                        <XCircle :size="12" />
                        REJECT
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="!eventsLoading && pendingEvents.length === 0">
                  <td colspan="8" class="py-12 text-center text-gray-400 text-sm">No pending event requests</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="flex min-h-0 min-w-0 shrink-0 flex-col lg:max-w-none lg:flex-[0_0_32%]">
        <ScheduledEventsCalendar :events="calendarEvents" class="min-h-0" />
      </div>
    </div>

    <OsasEventDetailModal
      v-if="selectedEvent"
      :event="selectedEvent"
      @close="selectedEvent = null"
      @approve="onModalApprove"
      @reject="onModalReject"
    />
  </div>
</template>
