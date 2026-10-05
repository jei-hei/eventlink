<script setup lang="ts">
import { computed } from "vue";
import { Calendar, CheckCircle, XCircle } from "lucide-vue-next";
import type { PortalEvent } from "@/types/portalEvent";
import ScheduledEventsCalendar from "@/components/ScheduledEventsCalendar.vue";
import { mapPortalEventsToCalendar } from "@/composables/mapPortalEventsToCalendar";
import { useEventsTableLoading } from "@/composables/useEventsTableLoading";
import PortalTableSkeleton from "@/components/portal/PortalTableSkeleton.vue";
import { resourceOfficeLabel, type ResourceOffice } from "@/types/resourceOffice";

const props = withDefaults(
  defineProps<{
    office: ResourceOffice;
    events: PortalEvent[];
    scheduledEvents?: PortalEvent[];
    title: string;
    busy?: boolean;
    pendingCount?: number;
    showCalendar?: boolean;
  }>(),
  {
    scheduledEvents: () => [],
    showCalendar: true,
  },
);

const emit = defineEmits<{
  approve: [id: string];
  reject: [id: string];
}>();

const eventsLoading = useEventsTableLoading();

const resourceKindFilter = computed(() => null as "venue" | "equipment" | null);

const resourceColumnLabel = computed(() =>
  props.office === "ssc" ? "Assigned venue" : "Assigned resources",
);

const showQuantity = computed(() =>
  props.events.some((e) =>
    (e.resourceAssignments ?? []).some(
      (a) => a.assignedOffice === props.office && a.resourceKind === "equipment",
    ),
  ),
);

function officeAssignments(event: PortalEvent) {
  const kind = resourceKindFilter.value;
  return (event.resourceAssignments ?? []).filter(
    (a) =>
      a.assignedOffice === props.office &&
      a.status === "pending" &&
      (kind == null || a.resourceKind === kind),
  );
}

const pending = computed(() => props.events);
const badgeCount = computed(() => Math.max(props.pendingCount ?? 0, pending.value.length));

const calendarEvents = computed(() => mapPortalEventsToCalendar(props.scheduledEvents ?? []));

function assignedSummary(event: PortalEvent) {
  return officeAssignments(event)
    .map((a) => (a.resourceKind === "equipment" ? `${a.resourceName} (x${a.quantity})` : a.resourceName))
    .join(", ");
}

function assignedQuantity(event: PortalEvent) {
  const qty = officeAssignments(event).reduce((sum, a) => sum + Math.max(1, Number(a.quantity || 1)), 0);
  return qty || "—";
}

const colCount = computed(() => (showQuantity.value ? 7 : 6));
</script>

<template>
  <div class="dash-page">
    <div :class="showCalendar ? 'dash-split' : 'flex min-h-0 min-w-0 flex-1 flex-col'">
      <div class="flex min-h-0 min-w-0 flex-col">
        <div class="dash-card dash-card-fill">
          <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2.5 sm:px-4">
            <Calendar :size="18" class="text-emerald-600" />
            <h2 class="text-xs font-bold uppercase tracking-wide text-slate-800 sm:text-sm">{{ title }}</h2>
            <span
              v-if="badgeCount > 0"
              class="rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-2 py-0.5 text-xs font-bold text-white shadow-sm"
            >
              {{ badgeCount }}
            </span>
          </div>

          <div class="min-h-0 flex-1 overflow-auto">
            <table class="w-full min-w-[36rem] text-left sm:min-w-0">
              <thead class="sticky top-0 z-10 bg-slate-50">
                <tr>
                  <th class="border-r border-slate-200 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">Activity</th>
                  <th class="border-r border-slate-200 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">Organization</th>
                  <th class="border-r border-slate-200 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">Date / time</th>
                  <th class="border-r border-slate-200 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">{{ resourceColumnLabel }}</th>
                  <th
                    v-if="showQuantity"
                    class="border-r border-slate-200 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600"
                  >
                    Quantity
                  </th>
                  <th class="border-r border-slate-200 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">Status</th>
                  <th
                    class="sticky right-0 z-20 min-w-[8.5rem] bg-slate-50 px-3 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-slate-600 shadow-[-6px_0_10px_-6px_rgba(15,23,42,0.2)]"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                <PortalTableSkeleton v-if="eventsLoading" :rows="5" :columns="colCount" />
                <tr v-else-if="!pending.length">
                  <td :colspan="colCount" class="py-12 text-center text-sm text-gray-400">
                    No pending requests assigned to {{ resourceOfficeLabel(office) }}
                  </td>
                </tr>
                <template v-else>
                  <tr
                    v-for="event in pending"
                    :key="event.id"
                    class="border-b border-slate-100 transition hover:bg-emerald-50/50"
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
                    <td
                      v-if="showQuantity"
                      class="border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600"
                    >
                      {{ assignedQuantity(event) }}
                    </td>
                    <td class="border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600">
                      <span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        {{ event.status }}
                      </span>
                    </td>
                    <td
                      class="sticky right-0 z-10 bg-white/95 px-2 py-2 text-center shadow-[-6px_0_10px_-6px_rgba(15,23,42,0.15)] sm:px-3"
                    >
                      <div class="flex flex-col items-stretch gap-1.5 sm:flex-row sm:flex-wrap sm:justify-center">
                        <button
                          type="button"
                          class="inline-flex items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-700 px-2 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:from-emerald-500 hover:to-teal-600 disabled:opacity-60 sm:text-xs"
                          :disabled="busy"
                          @click="emit('approve', event.id)"
                        >
                          <CheckCircle :size="12" />
                          Approve
                        </button>
                        <button
                          type="button"
                          class="inline-flex items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-red-600 to-red-700 px-2 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:from-red-500 hover:to-red-600 disabled:opacity-60 sm:text-xs"
                          :disabled="busy"
                          @click="emit('reject', event.id)"
                        >
                          <XCircle :size="12" />
                          Reject
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

      <div v-if="showCalendar" class="flex min-h-0 min-w-0 flex-col">
        <ScheduledEventsCalendar :events="calendarEvents" class="h-full min-h-0" />
      </div>
    </div>
  </div>
</template>
