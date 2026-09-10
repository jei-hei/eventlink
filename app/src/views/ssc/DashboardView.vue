<script setup lang="ts">
import { ref, computed, defineAsyncComponent, onMounted } from "vue";
import { Calendar, Plus } from "lucide-vue-next";
import type { SscEvent } from "./types";
import { useSscPortal } from "./portalContext";
import ScheduledEventsCalendar from "@/components/ScheduledEventsCalendar.vue";
import CreatePostButton from "@/components/portal/CreatePostButton.vue";
import { mapPortalEventsToCalendar } from "@/composables/mapPortalEventsToCalendar";
import { publishStatusLabel } from "@/composables/eventPublish";
import { mergeMyPortalEvents } from "@/composables/mergeMyPortalEvents";
import { useAuthStore } from "@/stores/auth";
import { useEventsTableLoading } from "@/composables/useEventsTableLoading";
import PortalTableSkeleton from "@/components/portal/PortalTableSkeleton.vue";
import { useDashboardLifecycleLog } from "@/composables/useDashboardLifecycleLog";

useDashboardLifecycleLog("ssc/DashboardView");

const DashboardCreateEventModal = defineAsyncComponent(
  () => import("./components/DashboardCreateEventModal.vue"),
);
const DashboardEventDetailModal = defineAsyncComponent(
  () => import("./components/DashboardEventDetailModal.vue"),
);

const { events, approvedEvents, scheduledEvents, handleCreateFeedPost, pushToast } = useSscPortal();
const eventsLoading = useEventsTableLoading();
const auth = useAuthStore();

const selectedEvent = ref<SscEvent | null>(null);
const createOpen = ref(false);
const seenReminderToken = ref("");

const myEvents = computed(() => mergeMyPortalEvents(events, approvedEvents));

const pendingCount = computed(() => events.value.length);
const approvedNoticeCount = computed(
  () => approvedEvents.value.filter((e) => e.awaitingPublish || e.status === "Approved" || e.posted).length,
);
const reminderToken = computed(() =>
  approvedEvents.value
    .filter((e) => e.awaitingPublish || e.status === "Approved" || e.posted)
    .map((e) => `${e.id}:${e.status}:${e.awaitingPublish ? 1 : 0}:${e.posted ? 1 : 0}`)
    .sort()
    .join("|"),
);
const reminderStorageKey = computed(() => `eventlink:ssc:approved-reminder-seen:${auth.userId ?? "anon"}`);
const showApprovedReminder = computed(
  () => approvedNoticeCount.value > 0 && reminderToken.value !== seenReminderToken.value,
);

const calendarEvents = computed(() => mapPortalEventsToCalendar(scheduledEvents.value));

onMounted(() => {
  if (typeof window === "undefined") return;
  try {
    seenReminderToken.value = window.localStorage.getItem(reminderStorageKey.value) ?? "";
  } catch {
    seenReminderToken.value = "";
  }
});

function workflowRowClass(event: SscEvent) {
  const ws = event.workflowStatus;
  if (ws === "Pending Adviser") return "bg-yellow-100 text-yellow-700";
  if (ws === "Pending Dean") return "bg-orange-100 text-orange-700";
  if (ws === "Pending GSO") return "bg-blue-100 text-blue-700";
  if (ws === "Pending OSAS") return "bg-indigo-100 text-indigo-700";
  if (ws === "Pending EO") return "bg-purple-100 text-purple-700";
  return "bg-green-100 text-green-700";
}

async function publishFeedPost(payload: Parameters<typeof handleCreateFeedPost>[0]) {
  await handleCreateFeedPost(payload);
  pushToast("Posted to campus feed", "Your post is live on /events.", "success");
}
</script>

<template>
  <div class="dash-page dash-page-flow">
    <div class="dash-split">
      <div class="flex min-h-0 min-w-0 flex-col">
        <div class="dash-card flex min-h-0 flex-1 flex-col overflow-visible">
          <div class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
            <div class="flex items-center gap-2">
              <Calendar :size="18" class="text-[#16A34A]" />
              <h2 class="font-bold text-sm text-gray-800 uppercase tracking-wide">Requests in review</h2>
              <span
                v-if="pendingCount > 0"
                class="bg-[#16A34A] text-white text-xs font-bold px-2 py-0.5 rounded-full"
              >
                {{ pendingCount }}
              </span>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <CreatePostButton :my-events="myEvents" :publish-fn="publishFeedPost" />
              <button
                type="button"
                class="btn-gradient px-3 py-1.5 text-xs shadow"
                @click="createOpen = true"
              >
                <Plus :size="14" />
                Create event request
              </button>
            </div>
          </div>

          <p
            v-if="showApprovedReminder"
            class="mx-3 mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 sm:mx-4"
          >
            {{ approvedNoticeCount }} request(s) are already approved. Check the Events page.
          </p>

          <div class="min-w-0">
            <table class="w-full table-fixed">
              <colgroup>
                <col class="w-[28%]" />
                <col class="w-[16%]" />
                <col class="w-[20%]" />
                <col class="w-[20%]" />
                <col class="w-[16%]" />
              </colgroup>
              <thead class="hidden bg-gray-50 md:table-header-group">
                <tr>
                  <th
                    class="px-3 py-2.5 text-left font-bold border-r border-gray-200 text-xs text-gray-600 uppercase tracking-wide"
                  >
                    Event
                  </th>
                  <th
                    class="px-3 py-2.5 text-left font-bold border-r border-gray-200 text-xs text-gray-600 uppercase tracking-wide"
                  >
                    Date
                  </th>
                  <th
                    class="px-3 py-2.5 text-left font-bold border-r border-gray-200 text-xs text-gray-600 uppercase tracking-wide"
                  >
                    Time
                  </th>
                  <th
                    class="px-3 py-2.5 text-left font-bold border-r border-gray-200 text-xs text-gray-600 uppercase tracking-wide"
                  >
                    Venue
                  </th>
                  <th class="px-3 py-2.5 text-left font-bold text-xs text-gray-600 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody class="block md:table-row-group">
                <PortalTableSkeleton v-if="eventsLoading" :rows="4" :columns="5" />
                <tr
                  v-else
                  v-for="event in events"
                  :key="event.id"
                  class="block border-b border-gray-100 px-3 py-2 hover:bg-gray-50 transition cursor-pointer md:table-row md:px-0 md:py-0"
                  @click="selectedEvent = event"
                >
                  <td class="flex min-w-0 gap-3 border-gray-100 py-1.5 text-sm text-gray-800 md:table-cell md:border-r md:px-3 md:py-2.5">
                    <span class="w-20 shrink-0 text-xs font-bold uppercase tracking-wide text-gray-500 md:hidden">Event</span>
                    <span class="min-w-0 flex-1 break-words whitespace-normal font-medium">{{ event.name }}</span>
                  </td>
                  <td class="flex min-w-0 gap-3 border-gray-100 py-1.5 text-sm text-gray-700 md:table-cell md:border-r md:px-3 md:py-2.5">
                    <span class="w-20 shrink-0 text-xs font-bold uppercase tracking-wide text-gray-500 md:hidden">Date</span>
                    <span class="min-w-0 flex-1 break-words whitespace-normal">{{ event.date || "—" }}</span>
                  </td>
                  <td class="flex min-w-0 gap-3 border-gray-100 py-1.5 text-sm text-gray-700 md:table-cell md:border-r md:px-3 md:py-2.5">
                    <span class="w-20 shrink-0 text-xs font-bold uppercase tracking-wide text-gray-500 md:hidden">Time</span>
                    <span class="min-w-0 flex-1 break-words whitespace-normal">
                      {{ event.startTime && event.endTime ? `${event.startTime} – ${event.endTime}` : event.startTime || event.endTime || "—" }}
                    </span>
                  </td>
                  <td class="flex min-w-0 gap-3 border-gray-100 py-1.5 text-sm text-gray-700 md:table-cell md:border-r md:px-3 md:py-2.5">
                    <span class="w-20 shrink-0 text-xs font-bold uppercase tracking-wide text-gray-500 md:hidden">Venue</span>
                    <span class="min-w-0 flex-1 break-words whitespace-normal">{{ event.venue || "—" }}</span>
                  </td>
                  <td class="flex min-w-0 gap-3 py-1.5 md:table-cell md:px-3 md:py-2.5">
                    <span class="w-20 shrink-0 text-xs font-bold uppercase tracking-wide text-gray-500 md:hidden">Status</span>
                    <span class="min-w-0 flex-1">
                      <span
                        :class="['inline-block max-w-full break-words whitespace-normal px-2 py-1 rounded text-xs font-semibold', workflowRowClass(event)]"
                      >
                        {{ publishStatusLabel(event) }}
                      </span>
                    </span>
                  </td>
                </tr>
                <tr v-if="!eventsLoading && events.length === 0" class="block md:table-row">
                  <td colspan="5" class="block py-12 text-center text-sm text-gray-400 md:table-cell">
                    No requests waiting for approval.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="flex min-h-0 min-w-0 flex-col">
        <ScheduledEventsCalendar title="Campus calendar (posted)" :events="calendarEvents" class="h-full min-h-0" />
      </div>
    </div>

    <DashboardCreateEventModal :open="createOpen" @close="createOpen = false" />
    <DashboardEventDetailModal
      :event="selectedEvent"
      @close="selectedEvent = null"
    />
  </div>
</template>
