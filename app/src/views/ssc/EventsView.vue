<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { CheckCircle, Search, X } from "lucide-vue-next";
import type { SscEvent } from "./types";
import { useSscPortal } from "./portalContext";
import EventLetterDownloadButton from "@/components/portal/EventLetterDownloadButton.vue";
import { useAuthStore } from "@/stores/auth";

const { approvedEvents } = useSscPortal();
const auth = useAuthStore();

/** Approved/posted requests — original Word letter lives on the request */
const requestEvents = computed(() =>
  approvedEvents.value.filter((e) => e.awaitingPublish || e.status === "Approved" || e.posted),
);
const reminderToken = computed(() =>
  requestEvents.value
    .map((e) => `${e.id}:${e.status}:${e.awaitingPublish ? 1 : 0}:${e.posted ? 1 : 0}`)
    .sort()
    .join("|"),
);
const reminderStorageKey = computed(() => `eventlink:ssc:approved-reminder-seen:${auth.userId ?? "anon"}`);

function markReminderSeen() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(reminderStorageKey.value, reminderToken.value);
  } catch {
    // no-op
  }
}

onMounted(markReminderSeen);
watch(reminderToken, () => {
  markReminderSeen();
});

const searchQuery = ref("");
const selectedEvent = ref<SscEvent | null>(null);

const filteredRequests = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return requestEvents.value;
  return requestEvents.value.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      (e.organization ?? "").toLowerCase().includes(q) ||
      e.venue.toLowerCase().includes(q),
  );
});
</script>

<template>
  <div class="dash-page flex flex-col">
    <div class="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-800 tracking-tight">Events</h1>
        <p class="text-gray-500 text-sm mt-1">
          Your approved event requests. <strong>Download Word</strong> is the file uploaded when the request was
          created.
        </p>
      </div>
      <div class="relative w-full sm:w-72 sm:ml-auto">
          <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search events..."
            class="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A] focus:border-transparent transition shadow-sm"
          />
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-lg flex-1 flex flex-col border border-gray-100 overflow-hidden min-h-0">
      <div class="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
        <h2 class="font-bold text-sm text-gray-800 uppercase tracking-wide flex items-center gap-2">
          <CheckCircle :size="16" class="text-[#16A34A]" />
          My event requests
        </h2>
        <div class="bg-[#DCFCE7] text-[#16A34A] text-xs font-bold px-2.5 py-1 rounded-full">
          {{ requestEvents.length }} approved
        </div>
      </div>

      <div class="flex-1 overflow-auto">
        <table class="w-full text-left border-collapse">
          <thead class="bg-gray-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th class="px-6 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                Event Name
              </th>
              <th class="px-6 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                Organization
              </th>
              <th class="px-6 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                Venue
              </th>
              <th class="px-6 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">Date</th>
              <th
                class="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200"
              >
                Request letter
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="filteredRequests.length === 0">
              <td colspan="5" class="py-12 text-center text-gray-400">
                <p class="text-sm">No approved event requests yet.</p>
              </td>
            </tr>
            <tr
              v-for="event in filteredRequests"
              :key="event.id"
              class="hover:bg-green-50/50 transition-colors group bg-white cursor-pointer"
              @click="selectedEvent = event"
            >
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="font-bold text-sm text-gray-800 group-hover:text-[#16A34A]">{{ event.name }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-md">
                  {{ event.organization }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{{ event.venue }}</td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="bg-[#DCFCE7] text-[#16A34A] px-2.5 py-1 rounded text-xs font-bold">{{ event.date }}</span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right" @click.stop>
                <EventLetterDownloadButton :event="event" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div
      v-if="selectedEvent"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="selectedEvent = null"
    >
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden" @click.stop>
        <div class="bg-[#16A34A] text-white px-5 py-3 flex justify-between items-center">
          <h3 class="font-bold text-sm">{{ selectedEvent.name }}</h3>
          <button type="button" class="p-1 hover:bg-[#15803D] rounded" @click="selectedEvent = null">
            <X :size="18" />
          </button>
        </div>
        <div class="p-5 space-y-3 text-sm">
          <p><span class="text-gray-500">Organization:</span> {{ selectedEvent.organization }}</p>
          <p><span class="text-gray-500">Date:</span> {{ selectedEvent.date }}</p>
          <p><span class="text-gray-500">Venue:</span> {{ selectedEvent.venue }}</p>
          <div class="pt-2">
            <EventLetterDownloadButton :event="selectedEvent" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
