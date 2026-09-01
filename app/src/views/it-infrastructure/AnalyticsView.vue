<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { TrendingUp, CalendarDays, CheckCircle2, BarChart2, Clock, AlertTriangle } from "lucide-vue-next";
import ViewAllDashboardButton from "@/components/portal/ViewAllDashboardButton.vue";
import { fetchAnalyticsOverview } from "@/services/analyticsDb";

const monthlyEvents = ref([{ id: "m1", month: "Jan", events: 0, approved: 0, rejected: 0 }]);
const eventStatusData = ref([
  { name: "Approved" as const, value: 0, color: "#4ADE80" },
  { name: "Pending" as const, value: 0, color: "#D97706" },
  { name: "Rejected" as const, value: 0, color: "#DC2626" },
]);
const recentActivity = ref<{ id: number; action: string; event: string; time: string; org: string; icon: string }[]>([]);
const totals = ref({
  totalThisYear: 0,
  approvedThisMonth: 0,
  approvedLastMonth: 0,
  pendingCount: 0,
  awaitingPublishCount: 0,
  allTimeCount: 0,
});
const peakMonthLabel = ref("No data yet");
const analyticsError = ref<string | null>(null);

async function loadAnalytics() {
  try {
    const data = await fetchAnalyticsOverview("it_infrastructure");
    monthlyEvents.value = data.monthlyEvents.length ? data.monthlyEvents : monthlyEvents.value;
    eventStatusData.value = data.eventStatusData;
    recentActivity.value = data.recentActivity;
    totals.value = data.totals;
    peakMonthLabel.value = data.peakMonthLabel;
  } catch (e) {
    analyticsError.value = e instanceof Error ? e.message : "Could not load analytics.";
  }
}

onMounted(() => void loadAnalytics());

const maxEvents = computed(() => Math.max(1, ...monthlyEvents.value.map((m) => m.events)));
</script>

<template>
  <div class="dash-page space-y-4">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">Analytics</h1>
        <p class="text-sm text-gray-500">IT Infrastructure resource approval overview</p>
      </div>
      <ViewAllDashboardButton to="/it-infrastructure" />
    </div>
    <p v-if="analyticsError" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      {{ analyticsError }}
    </p>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="dash-card p-4">
        <div class="mb-2 flex items-center gap-2 text-sm text-gray-500"><CalendarDays :size="16" /> This year</div>
        <p class="text-2xl font-bold text-gray-900">{{ totals.totalThisYear }}</p>
      </div>
      <div class="dash-card p-4">
        <div class="mb-2 flex items-center gap-2 text-sm text-gray-500"><CheckCircle2 :size="16" /> Approved month</div>
        <p class="text-2xl font-bold text-gray-900">{{ totals.approvedThisMonth }}</p>
      </div>
      <div class="dash-card p-4">
        <div class="mb-2 flex items-center gap-2 text-sm text-gray-500"><Clock :size="16" /> Pending</div>
        <p class="text-2xl font-bold text-gray-900">{{ totals.pendingCount }}</p>
      </div>
      <div class="dash-card p-4">
        <div class="mb-2 flex items-center gap-2 text-sm text-gray-500"><TrendingUp :size="16" /> Peak month</div>
        <p class="text-2xl font-bold text-gray-900">{{ peakMonthLabel }}</p>
      </div>
    </div>
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="dash-card p-4">
        <h2 class="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-700">
          <BarChart2 :size="16" class="text-emerald-600" /> Monthly events
        </h2>
        <div class="flex h-40 items-end gap-2">
          <div v-for="m in monthlyEvents" :key="m.id" class="flex flex-1 flex-col items-center gap-1">
            <div class="w-full rounded-t bg-emerald-500" :style="{ height: `${(m.events / maxEvents) * 100}%`, minHeight: m.events ? '4px' : '0' }" />
            <span class="text-[10px] text-gray-500">{{ m.month }}</span>
          </div>
        </div>
      </div>
      <div class="dash-card p-4">
        <h2 class="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-700">
          <AlertTriangle :size="16" class="text-amber-600" /> Status mix
        </h2>
        <ul class="space-y-2">
          <li v-for="s in eventStatusData" :key="s.name" class="flex items-center justify-between text-sm">
            <span class="flex items-center gap-2">
              <span class="h-2.5 w-2.5 rounded-full" :style="{ background: s.color }" />
              {{ s.name }}
            </span>
            <span class="font-semibold">{{ s.value }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
