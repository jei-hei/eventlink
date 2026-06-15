<script setup lang="ts">
import { ref, computed } from "vue";
import { CheckCircle, Search } from "lucide-vue-next";
import type { EoEvent } from "./types";
import { useExecutivePortal } from "./portalContext";
import EventLetterDownloadButton from "@/components/portal/EventLetterDownloadButton.vue";

const { approvedEvents } = useExecutivePortal();
const search = ref("");

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return approvedEvents.value;
  return approvedEvents.value.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      (e.organization ?? "").toLowerCase().includes(q) ||
      e.venue.toLowerCase().includes(q) ||
      e.date.toLowerCase().includes(q),
  );
});
</script>

<template>
  <div class="dash-page flex flex-col">
    <div class="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-800 tracking-tight">Events</h1>
        <p class="text-gray-500 text-sm mt-1">
          Approved events. <strong>Download Word</strong> is the organization’s uploaded request file.
        </p>
      </div>
      <div class="relative w-full sm:w-72">
        <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          v-model="search"
          type="text"
          placeholder="Search approved events..."
          class="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A] focus:border-transparent transition shadow-sm"
        />
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-lg flex-1 flex flex-col border border-gray-100 overflow-hidden min-h-0">
      <div class="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h2 class="font-bold text-sm text-gray-800 uppercase tracking-wide flex items-center gap-2">
          <CheckCircle :size="16" class="text-[#16A34A]" />
          Approved Events
        </h2>
        <div class="bg-[#DCFCE7] text-[#16A34A] text-xs font-bold px-2.5 py-1 rounded-full">{{ approvedEvents.length }} Total</div>
      </div>

      <div class="flex-1 overflow-auto">
        <table class="w-full text-left border-collapse">
          <thead class="bg-gray-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th class="px-6 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">Event Name</th>
              <th class="px-6 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">Organization</th>
              <th class="px-6 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">Date/Time</th>
              <th class="px-6 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">Venue</th>
              <th class="px-6 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">No. of Participants</th>
              <th class="px-6 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">SDG/s</th>
              <th class="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">Request letter</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="filtered.length === 0">
              <td colspan="7" class="py-12 text-center text-gray-400">
                <div class="flex flex-col items-center justify-center gap-3">
                  <div class="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-300">
                    <CheckCircle :size="24" />
                  </div>
                  <p class="text-sm">{{ search.trim() ? "No matching events." : "No approved events yet." }}</p>
                </div>
              </td>
            </tr>
            <tr v-for="event in filtered" :key="event.id" class="hover:bg-green-50/50 transition-colors group bg-white">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="font-bold text-sm text-gray-800 group-hover:text-[#16A34A] transition-colors">{{ event.name }}</div>
                <div v-if="event.description" class="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{{ event.description }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-md">{{ event.organization }}</span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="bg-[#DCFCE7] text-[#16A34A] px-2.5 py-1 rounded text-xs font-bold tracking-wide">{{ event.date }}</span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{{ event.venue }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{{ event.participants ?? "—" }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{{ event.sdgs ?? "—" }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-right">
                <EventLetterDownloadButton :event="event" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
