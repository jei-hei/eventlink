<script setup lang="ts">
import { computed, ref } from "vue";
import { Calendar, CheckCircle, XCircle } from "lucide-vue-next";
import type { PortalEvent } from "@/types/portalEvent";
import ScheduledEventsCalendar from "@/components/ScheduledEventsCalendar.vue";
import { mapPortalEventsToCalendar } from "@/composables/mapPortalEventsToCalendar";
import { useEventsTableLoading } from "@/composables/useEventsTableLoading";
import PortalTableSkeleton from "@/components/portal/PortalTableSkeleton.vue";
import { resourceOfficeLabel, type ResourceOffice } from "@/types/resourceOffice";

const props = defineProps<{
  office: ResourceOffice;
  events: PortalEvent[];
  scheduledEvents: PortalEvent[];
  title: string;
}>();

const emit = defineEmits<{
  approve: [id: string];
  reject: [id: string];
}>();

const eventsLoading = useEventsTableLoading();
const selectedEvent = ref<PortalEvent | null>(null);

const pending = computed(() =>
  props.events.filter((e) => {
    if (e.status !== "Pending") return false;
    const assigned = (e.resourceAssignments ?? []).filter(
      (a) => a.assignedOffice === props.office && a.status === "pending",
    );
    return assigned.length > 0 || (!e.resourceAssignments?.length && props.office === "gso");
  }),
);

const calendarEvents = computed(() => mapPortalEventsToCalendar(props.scheduledEvents));

function assignedSummary(event: PortalEvent) {
  return (event.resourceAssignments ?? [])
    .filter((a) => a.assignedOffice === props.office)
    .map((a) => (a.resourceKind === "equipment" ? `${a.resourceName} (x${a.quantity})` : a.resourceName))
    .join(", ");
}

function onApprove(event: PortalEvent) {
  emit("approve", event.id);
  selectedEvent.value = null;
}

function onReject(event: PortalEvent) {
  emit("reject", event.id);
  selectedEvent.value = null;
}
</script>

<template>
  <div class="dash-page">
    <div class="dash-split lg:flex-col xl:flex-row xl:items-start">
      <div class="flex min-h-0 min-w-0 flex-1 flex-col gap-3 sm:gap-4 xl:flex-[0_0_68%]">
        <div class="dash-card flex min-h-[min(220px,45vh)] flex-1 flex-col">
          <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2.5 sm:px-4">
            <Calendar :size="18" class="text-emerald-600" />
            <h2 class="text-xs font-bold uppercase tracking-wide text-slate-800 sm:text-sm">{{ title }}</h2>
            <span
              v-if="pending.length > 0"
              class="rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-2 py-0.5 text-xs font-bold text-white shadow-sm"
            >
              {{ pending.length }}
            </span>
          </div>

          <div class="min-h-0 flex-1 overflow-auto">
            <table class="w-full min-w-[36rem] text-left sm:min-w-0">
              <thead class="sticky top-0 z-10 bg-slate-50">
                <tr>
                  <th class="border-r border-slate-200 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">Activity</th>
                  <th class="border-r border-slate-200 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">Organization</th>
                  <th class="border-r border-slate-200 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">Date / time</th>
                  <th class="border-r border-slate-200 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">Assigned resources</th>
                  <th class="px-3 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                <PortalTableSkeleton v-if="eventsLoading" :rows="5" :columns="5" />
                <tr v-else-if="!pending.length">
                  <td colspan="5" class="py-12 text-center text-sm text-gray-400">
                    No pending requests assigned to {{ resourceOfficeLabel(office) }}
                  </td>
                </tr>
                <template v-else>
                  <tr
                    v-for="event in pending"
                    :key="event.id"
                    class="cursor-pointer border-b border-slate-100 transition hover:bg-emerald-50/50"
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
                    <td class="border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600">
                      {{ assignedSummary(event) || event.venue || event.itemsEquipment || "—" }}
                    </td>
                    <td class="px-2 py-2 text-center" @click.stop>
                      <div class="flex flex-wrap justify-center gap-1.5">
                        <button
                          type="button"
                          class="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-700 px-2 py-1.5 text-xs font-semibold text-white"
                          @click="onApprove(event)"
                        >
                          <CheckCircle :size="12" /> Approve
                        </button>
                        <button
                          type="button"
                          class="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2 py-1.5 text-xs font-semibold text-white"
                          @click="onReject(event)"
                        >
                          <XCircle :size="12" /> Decline
                        </button>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="flex min-h-0 min-w-0 flex-col gap-3 lg:max-w-none xl:flex-[0_0_32%]">
        <ScheduledEventsCalendar :events="calendarEvents" class="min-h-0" />
      </div>
    </div>

    <div
      v-if="selectedEvent"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="selectedEvent = null"
    >
      <div class="mx-4 w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
        <div class="flex items-center justify-between bg-[#16A34A] px-6 py-4 text-white">
          <h3 class="text-base font-bold">Event Details</h3>
          <button type="button" class="rounded-lg p-1.5 hover:bg-[#15803D]" @click="selectedEvent = null">✕</button>
        </div>
        <div class="space-y-3 p-6 text-sm">
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-gray-500">Activity</p>
            <p class="font-medium text-gray-800">{{ selectedEvent.name }}</p>
          </div>
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-gray-500">Organization</p>
            <p class="font-medium text-gray-800">{{ selectedEvent.organization }}</p>
          </div>
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-gray-500">Date / time</p>
            <p class="font-medium text-gray-800">{{ selectedEvent.date }} · {{ selectedEvent.startTime }} – {{ selectedEvent.endTime }}</p>
          </div>
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-gray-500">Assigned to {{ resourceOfficeLabel(office) }}</p>
            <p class="font-medium text-gray-800">{{ assignedSummary(selectedEvent) || "—" }}</p>
          </div>
        </div>
        <div class="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4">
          <button type="button" class="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold" @click="selectedEvent = null">Close</button>
          <button type="button" class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white" @click="onReject(selectedEvent)">Decline</button>
          <button type="button" class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" @click="onApprove(selectedEvent)">Approve</button>
        </div>
      </div>
    </div>
  </div>
</template>
