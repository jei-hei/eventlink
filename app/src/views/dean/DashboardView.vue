<script setup lang="ts">
import { computed, ref } from "vue";
import { Calendar, Check, XCircle } from "lucide-vue-next";
import type { DeanEvent } from "./types";
import { useDeanPortal } from "./portalContext";
import DeanEventDetailModal from "./components/DeanEventDetailModal.vue";
import ScheduledEventsCalendar from "@/components/ScheduledEventsCalendar.vue";
import { mapPortalEventsToCalendar } from "@/composables/mapPortalEventsToCalendar";

const { events, scheduledEvents, handleApprove, handleReject } = useDeanPortal();

const selectedEvent = ref<DeanEvent | null>(null);

const pendingCount = computed(() => events.value.filter((e) => e.status === "Pending").length);

const calendarEvents = computed(() => mapPortalEventsToCalendar(scheduledEvents.value));
</script>

<template>
  <div class="dash-page">
    <div class="dash-split">
      <div class="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-[0_0_68%]">
        <div class="dash-card flex min-h-[min(220px,45vh)] flex-1 flex-col">
          <div class="px-4 py-3 border-b border-gray-200 flex items-center gap-2 flex-wrap shrink-0">
            <Calendar :size="18" class="text-[#16A34A]" />
            <h2 class="font-bold text-sm text-gray-800 uppercase tracking-wide">Events for Approval</h2>
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
                  <th class="px-3 py-2.5 text-center font-bold text-xs text-gray-600 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="event in events" :key="event.id" class="border-b border-gray-100 hover:bg-gray-50 transition">
                  <td class="px-3 py-2.5 border-r border-gray-100 text-sm text-gray-600 cursor-pointer" @click="selectedEvent = event">
                    {{ event.organization }}
                  </td>
                  <td class="px-3 py-2.5 border-r border-gray-100 text-sm font-medium text-gray-800 cursor-pointer" @click="selectedEvent = event">
                    {{ event.name }}
                  </td>
                  <td class="px-3 py-2.5 border-r border-gray-100 text-sm text-gray-600 cursor-pointer" @click="selectedEvent = event">
                    {{ event.date }}
                    <div v-if="event.startTime && event.endTime" class="text-xs text-gray-500">
                      {{ event.startTime }} - {{ event.endTime }}
                    </div>
                  </td>
                  <td class="px-3 py-2.5 border-r border-gray-100 text-sm text-gray-600 cursor-pointer" @click="selectedEvent = event">
                    {{ event.venue }}
                  </td>
                  <td class="px-3 py-2.5 border-r border-gray-100 text-sm text-gray-600 cursor-pointer" @click="selectedEvent = event">
                    {{ event.participants || "N/A" }}
                  </td>
                  <td class="px-3 py-2.5 border-r border-gray-100 text-sm text-gray-600 cursor-pointer" @click="selectedEvent = event">
                    {{ event.sdgs || "N/A" }}
                  </td>
                  <td class="px-3 py-2.5">
                    <div class="flex items-center justify-center gap-2 flex-wrap">
                      <button
                        type="button"
                        class="bg-[#16A34A] hover:bg-[#15803D] text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                        @click.stop="handleApprove(event.id)"
                      >
                        <Check :size="14" />
                        Approve
                      </button>
                      <button
                        type="button"
                        class="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                        @click.stop="handleReject(event.id)"
                      >
                        <XCircle :size="14" />
                        Decline
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="events.length === 0">
                  <td colspan="7" class="py-12 text-center text-gray-400 text-sm">No pending events</td>
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

    <DeanEventDetailModal v-if="selectedEvent" :event="selectedEvent" @close="selectedEvent = null" />
  </div>
</template>
