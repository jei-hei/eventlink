<script setup lang="ts">
import { ref, computed } from "vue";
import { Calendar, XCircle } from "lucide-vue-next";
import type { EoEvent } from "./types";
import { useExecutivePortal } from "./portalContext";
import EoCreateSscEventModal, { type EoCreateDirectPayload } from "./components/EoCreateSscEventModal.vue";
import EoEditScheduledEventModal from "./components/EoEditScheduledEventModal.vue";
import EoEventDetailModal from "./components/EoEventDetailModal.vue";
import ScheduledEventsCalendar from "@/components/ScheduledEventsCalendar.vue";
import type { ScheduledCalendarEvent } from "@/components/ScheduledEventsCalendar.vue";
import { mapPortalEventsToCalendar } from "@/composables/mapPortalEventsToCalendar";
import type { UpdateEventRequestInput } from "@/services/eventRequestsDb";
import { canPostToCalendar } from "@/composables/eventPublish";
import { useEventsTableLoading } from "@/composables/useEventsTableLoading";
import PortalTableSkeleton from "@/components/portal/PortalTableSkeleton.vue";

const eventsLoading = useEventsTableLoading();

const {
  events,
  scheduledEvents,
  handleReject,
  handleApproveAndForward,
  handleRequestRevision,
  handleCreateEvent,
  handlePostEvent,
  handleUpdateEvent,
  handleCancelScheduled,
  submitRequest,
  useDb,
} = useExecutivePortal();

function isReadyForCalendarPost(event: EoEvent) {
  return canPostToCalendar(event);
}

/** Table Cancel: decline pending request (reason required). */
function onTableCancel(event: EoEvent) {
  handleReject(event.id);
}

async function onApproveAndForward(
  id: string,
  assignments: import("@/types/resourceOffice").ResourceAssignmentInput[],
) {
  await handleApproveAndForward(id, assignments);
  selectedEvent.value = null;
}

function onDetailReject(id: string) {
  handleReject(id);
  selectedEvent.value = null;
}

async function onRequestRevision(id: string, comment: string, attachmentFile: File | null) {
  await handleRequestRevision(id, comment, attachmentFile);
  selectedEvent.value = null;
}

async function onPostToCalendar(id: string) {
  await handlePostEvent(id);
  selectedEvent.value = null;
}

const selectedEvent = ref<EoEvent | null>(null);
const editEvent = ref<EoEvent | null>(null);
const createOpen = ref(false);

const pendingCount = computed(() => events.value.filter((e) => e.status === "Pending").length);

const calendarEvents = computed(() => mapPortalEventsToCalendar(scheduledEvents.value));

const nextEventId = computed(() => {
  const combined = [...events.value, ...scheduledEvents.value];
  const nums = combined.map((e) => parseInt(e.id, 10)).filter((n) => !Number.isNaN(n));
  return nums.length ? Math.max(...nums) + 1 : 1;
});

async function onCreateSubmit(payload: EoCreateDirectPayload) {
  try {
    if (useDb.value) {
      const purpose =
        payload.eventKind === "faculty"
          ? `[COLLEGE:${payload.organizationName}] Faculty event`
          : "";
      await submitRequest({
        requestType: "eo_direct",
        organizationId: payload.eventKind === "student" ? payload.organizationId : null,
        activity: payload.activity,
        startDate: payload.startDate,
        endDate: payload.endDate,
        startTime: payload.startTime,
        endTime: payload.endTime,
        venue: "To be announced",
        numberOfParticipants: 1,
        sdgs: "",
        needsGso: false,
        purpose,
      });
      return;
    }

    const e: EoEvent = {
      id: String(nextEventId.value),
      name: payload.activity,
      activity: payload.activity,
      organization: payload.organizationName,
      date: payload.startDate,
      startDate: payload.startDate,
      endDate: payload.endDate,
      startTime: payload.startTime,
      endTime: payload.endTime,
      venue: "To be announced",
      status: "Approved",
      posted: false,
      calendarPosted: true,
    };
    handleCreateEvent(e);
  } catch (e) {
    window.alert(e instanceof Error ? e.message : String(e));
  }
}

function openAddEvent() {
  createOpen.value = true;
}

function onCalendarSelect(cal: ScheduledCalendarEvent) {
  const found = scheduledEvents.value.find((e) => e.id === cal.id);
  if (found) editEvent.value = found;
}

async function onEditSave(id: string, input: UpdateEventRequestInput) {
  await handleUpdateEvent(id, input);
  editEvent.value = null;
}

async function onCancelScheduled(id: string, reason: string) {
  await handleCancelScheduled(id, reason);
  editEvent.value = null;
}
</script>

<template>
  <div class="dash-page">
    <div class="dash-split">
      <div class="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-[0_0_68%]">
        <div class="dash-card flex min-h-[min(220px,45vh)] flex-1 flex-col">
          <div class="px-4 py-3 border-b border-gray-200 flex items-center gap-2 flex-wrap">
            <Calendar :size="18" class="text-[#16A34A]" />
            <h2 class="font-bold text-sm text-gray-800 uppercase tracking-wide">Pending Events Table</h2>
            <span v-if="pendingCount > 0" class="bg-[#16A34A] text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {{ pendingCount }}
            </span>
          </div>

          <div class="flex-1 overflow-auto">
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
                    No. of Participants
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
                <PortalTableSkeleton v-if="eventsLoading" :rows="5" :columns="7" />
                <tr v-else-if="events.length === 0">
                  <td colspan="7" class="py-12 text-center text-gray-400 text-sm">No pending events</td>
                </tr>
                <template v-else>
                  <tr
                    v-for="event in events"
                    :key="event.id"
                    :class="[
                      'border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer',
                      event.status === 'Conflict' ? 'bg-amber-50' : '',
                    ]"
                    @click="selectedEvent = event"
                  >
                    <td class="px-3 py-2.5 border-r border-gray-100 text-sm text-gray-600">{{ event.organization }}</td>
                    <td class="px-3 py-2.5 border-r border-gray-100 text-sm font-medium text-gray-800">{{ event.name }}</td>
                    <td class="px-3 py-2.5 border-r border-gray-100 text-sm text-gray-600">{{ event.date }}</td>
                    <td class="px-3 py-2.5 border-r border-gray-100 text-sm text-gray-600">{{ event.venue }}</td>
                    <td class="px-3 py-2.5 border-r border-gray-100 text-sm text-gray-600">{{ event.participants ?? "—" }}</td>
                    <td class="px-3 py-2.5 border-r border-gray-100 text-sm text-gray-600">{{ event.sdgs ?? "—" }}</td>
                    <td class="px-3 py-2.5 text-center" @click.stop>
                      <button
                        type="button"
                        class="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700"
                        @click="onTableCancel(event)"
                      >
                        <XCircle :size="12" />
                        Cancel
                      </button>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="flex min-h-0 min-w-0 flex-col gap-3 lg:max-w-none lg:flex-[0_0_32%]">
        <ScheduledEventsCalendar
          :events="calendarEvents"
          show-add-button
          selectable
          class="min-h-0"
          @add="openAddEvent"
          @select="onCalendarSelect"
        />
      </div>
    </div>

    <EoCreateSscEventModal v-model:open="createOpen" @submit="onCreateSubmit" />
    <EoEditScheduledEventModal
      :event="editEvent"
      @close="editEvent = null"
      @save="onEditSave"
      @cancel-event="onCancelScheduled"
    />
    <EoEventDetailModal
      v-if="selectedEvent"
      :event="selectedEvent"
      :can-post-to-calendar="isReadyForCalendarPost(selectedEvent)"
      @close="selectedEvent = null"
      @approve-and-forward="onApproveAndForward"
      @reject="onDetailReject"
      @request-revision="onRequestRevision"
      @post-to-calendar="onPostToCalendar"
    />
  </div>
</template>
