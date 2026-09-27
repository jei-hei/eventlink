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
import { useEventRequestsStore } from "@/stores/eventRequests";
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
const eventStore = useEventRequestsStore();

const selectedEvent = ref<SscEvent | null>(null);
const createOpen = ref(false);
const seenReminderToken = ref("");

const myEvents = computed(() => mergeMyPortalEvents(events, approvedEvents));

const pendingCount = computed(() => Math.max(eventStore.pendingActionCount, events.value.length));
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
  <div class="dash-page">
    <div class="dash-split">
      <div class="flex min-h-0 min-w-0 flex-col">
        <div class="dash-card dash-card-fill">
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
            class="mx-3 mt-3 shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 sm:mx-4"
          >
            {{ approvedNoticeCount }} request(s) are already approved. Check the Events page.
          </p>

          <div class="min-h-0 flex-1 overflow-auto">
            <table class="w-full">
              <thead class="bg-gray-50 sticky top-0 z-10">
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
              <tbody>
                <PortalTableSkeleton v-if="eventsLoading" :rows="5" :columns="5" />
                <tr v-else-if="events.length === 0">
                  <td colspan="5" class="py-12 text-center text-gray-400 text-sm">
                    No requests waiting for approval.
                  </td>
                </tr>
                <template v-else>
                  <tr
                    v-for="event in events"
                    :key="event.id"
                    class="border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer"
                    @click="selectedEvent = event"
                  >
                    <td class="px-3 py-2.5 border-r border-gray-100 text-sm font-medium text-gray-800">
                      {{ event.name }}
                    </td>
                    <td class="px-3 py-2.5 border-r border-gray-100 text-sm text-gray-600">
                      {{ event.date || "—" }}
                    </td>
                    <td class="px-3 py-2.5 border-r border-gray-100 text-sm text-gray-600">
                      {{
                        event.startTime && event.endTime
                          ? `${event.startTime} – ${event.endTime}`
                          : event.startTime || event.endTime || "—"
                      }}
                    </td>
                    <td class="px-3 py-2.5 border-r border-gray-100 text-sm text-gray-600">
                      {{ event.venue || "—" }}
                    </td>
                    <td class="px-3 py-2.5">
                      <span
                        :class="[
                          'inline-block max-w-full break-words whitespace-normal px-2 py-1 rounded text-xs font-semibold',
                          workflowRowClass(event),
                        ]"
                      >
                        {{ publishStatusLabel(event) }}
                      </span>
                    </td>
                  </tr>
                </template>
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
