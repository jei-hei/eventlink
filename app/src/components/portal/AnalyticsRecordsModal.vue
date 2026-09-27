<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Download, X } from "lucide-vue-next";
import PaginationControls from "@/components/PaginationControls.vue";
import { downloadCsv } from "@/utils/downloadCsv";
import { DEFAULT_PAGE_SIZE, clampPage, clampPageSize } from "@/types/pagination";
import { useUiStore } from "@/stores/ui";
import type { AnalyticsDrilldown, AnalyticsSummaryRow } from "@/composables/useAnalyticsDashboard";
import type { AnalyticsEventRecord } from "@/services/analyticsDb";

const props = defineProps<{
  drilldown: AnalyticsDrilldown | null;
}>();

const emit = defineEmits<{
  close: [];
  select: [row: AnalyticsSummaryRow];
}>();

const ui = useUiStore();
const page = ref(1);
const pageSize = ref(DEFAULT_PAGE_SIZE);

watch(
  () => props.drilldown,
  () => {
    page.value = 1;
  },
);

const isSummary = computed(() => props.drilldown?.view === "summary");
const summaryRows = computed(() =>
  props.drilldown?.view === "summary" ? props.drilldown.rows : [],
);
const eventRows = computed(() => (props.drilldown?.view === "events" ? props.drilldown.rows : []));
const total = computed(() => (isSummary.value ? summaryRows.value.length : eventRows.value.length));
const pagedSummary = computed(() => {
  const size = clampPageSize(pageSize.value);
  const from = (clampPage(page.value) - 1) * size;
  return summaryRows.value.slice(from, from + size);
});
const pagedEvents = computed(() => {
  const size = clampPageSize(pageSize.value);
  const from = (clampPage(page.value) - 1) * size;
  return eventRows.value.slice(from, from + size);
});

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function download() {
  const title = (props.drilldown?.title ?? "analytics").replace(/[^\w]+/g, "-").toLowerCase();
  if (props.drilldown?.view === "summary") {
    downloadCsv(`eventlink-${title}.csv`, [
      ["Name", "Events"],
      ...props.drilldown.rows.map((row) => [row.label, String(row.count)]),
    ]);
  } else if (props.drilldown?.view === "events") {
    downloadCsv(`eventlink-${title}.csv`, [
      ["Event", "Organization", "College", "Status", "Created"],
      ...props.drilldown.rows.map((row) => [
        row.activity,
        row.org,
        row.college,
        row.status,
        dateLabel(row.createdAt),
      ]),
    ]);
  }
  ui.pushToast("Downloaded", "Analytics records exported.", "success");
}

function onSelect(row: AnalyticsSummaryRow) {
  emit("select", row);
}

function statusClass(status: AnalyticsEventRecord["status"]): string {
  if (status === "Approved") return "bg-green-100 text-green-700";
  if (status === "Rejected") return "bg-red-100 text-red-700";
  return "bg-yellow-100 text-yellow-700";
}
</script>

<template>
  <div
    v-if="drilldown"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    @click.self="emit('close')"
  >
    <div class="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
      <div class="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div class="min-w-0">
          <h2 class="truncate text-sm font-bold text-gray-800">{{ drilldown.title }}</h2>
          <p class="text-xs text-gray-500">
            {{ total }} {{ isSummary ? "groups" : "events" }}
            <template v-if="isSummary"> · click a row for event records</template>
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            @click="download"
          >
            <Download :size="14" />
            Download CSV
          </button>
          <button type="button" class="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" @click="emit('close')">
            <X :size="16" />
          </button>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-auto">
        <table v-if="isSummary" class="w-full text-left text-sm">
          <thead class="sticky top-0 bg-slate-50">
            <tr>
              <th class="px-5 py-2.5 text-xs font-bold uppercase text-slate-600">Name</th>
              <th class="px-5 py-2.5 text-right text-xs font-bold uppercase text-slate-600">Events</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!pagedSummary.length">
              <td colspan="2" class="px-5 py-8 text-center text-xs text-gray-400">No records this month.</td>
            </tr>
            <tr
              v-for="row in pagedSummary"
              :key="row.key"
              class="cursor-pointer border-t border-gray-100 hover:bg-emerald-50/60"
              @click="onSelect(row)"
            >
              <td class="px-5 py-2.5 font-medium text-gray-800">{{ row.label }}</td>
              <td class="px-5 py-2.5 text-right font-semibold text-gray-700">{{ row.count }}</td>
            </tr>
          </tbody>
        </table>

        <table v-else class="w-full text-left text-sm">
          <thead class="sticky top-0 bg-slate-50">
            <tr>
              <th class="px-5 py-2.5 text-xs font-bold uppercase text-slate-600">Event</th>
              <th class="px-5 py-2.5 text-xs font-bold uppercase text-slate-600">Organization</th>
              <th class="px-5 py-2.5 text-xs font-bold uppercase text-slate-600">Status</th>
              <th class="px-5 py-2.5 text-xs font-bold uppercase text-slate-600">Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!pagedEvents.length">
              <td colspan="4" class="px-5 py-8 text-center text-xs text-gray-400">No event records this month.</td>
            </tr>
            <tr v-for="row in pagedEvents" :key="row.id" class="border-t border-gray-100">
              <td class="px-5 py-2.5 font-medium text-gray-800">{{ row.activity }}</td>
              <td class="px-5 py-2.5 text-gray-600">{{ row.org }}</td>
              <td class="px-5 py-2.5">
                <span class="rounded-full px-2 py-0.5 text-[10px] font-bold" :class="statusClass(row.status)">
                  {{ row.status }}
                </span>
              </td>
              <td class="px-5 py-2.5 text-xs text-gray-500">{{ dateLabel(row.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="border-t border-gray-100 px-3 py-2">
        <PaginationControls
          :page="page"
          :page-size="pageSize"
          :total="total"
          @update:page="page = $event"
          @update:page-size="pageSize = $event"
        />
      </div>
    </div>
  </div>
</template>
