<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { TrendingUp, CalendarDays, CheckCircle2, BarChart2, Clock } from "lucide-vue-next";
import ViewAllDashboardButton from "@/components/portal/ViewAllDashboardButton.vue";
import { fetchAnalyticsOverview } from "@/services/analyticsDb";

const eventStatusData = ref([
  { name: "Approved" as const, value: 0, color: "#4ADE80" },
  { name: "Pending" as const, value: 0, color: "#D97706" },
  { name: "Rejected" as const, value: 0, color: "#DC2626" },
]);
const recentActivity = ref<{ id: number; action: string; event: string; time: string; org: string; icon: string }[]>([]);
const totals = ref({ totalThisYear: 0, approvedThisMonth: 0, approvedLastMonth: 0, pendingCount: 0, allTimeCount: 0 });
const peakMonthLabel = ref("No data yet");
const analyticsError = ref<string | null>(null);

async function loadAnalytics() {
  try {
    const data = await fetchAnalyticsOverview("dean");
    eventStatusData.value = data.eventStatusData;
    recentActivity.value = data.recentActivity;
    totals.value = {
      totalThisYear: data.totals.totalThisYear,
      approvedThisMonth: data.totals.approvedThisMonth,
      approvedLastMonth: data.totals.approvedLastMonth,
      pendingCount: data.totals.pendingCount,
      allTimeCount: data.totals.allTimeCount,
    };
    peakMonthLabel.value = data.peakMonthLabel;
  } catch (e) {
    analyticsError.value = e instanceof Error ? e.message : "Could not load analytics.";
  }
}

onMounted(() => {
  void loadAnalytics();
});

const approvedDelta = computed(() => totals.value.approvedThisMonth - totals.value.approvedLastMonth);
const statCards = computed(() => [
  {
    label: "Total Events (This Year)",
    value: String(totals.value.totalThisYear),
    change: "Live from requests",
    changePositive: true,
    icon: CalendarDays,
    accent: "#16A34A",
    bg: "bg-green-50",
  },
  {
    label: "Approved This Month",
    value: String(totals.value.approvedThisMonth),
    change: approvedDelta.value >= 0 ? `+${approvedDelta.value} vs last month` : `${approvedDelta.value} vs last month`,
    changePositive: approvedDelta.value >= 0,
    icon: CheckCircle2,
    accent: "#4ADE80",
    bg: "bg-emerald-50",
  },
  {
    label: "Pending Approval",
    value: String(totals.value.pendingCount),
    change: "Action needed",
    changePositive: false,
    icon: Clock,
    accent: "#F59E0B",
    bg: "bg-yellow-50",
  },
]);

const pieTotal = computed(() => eventStatusData.value.reduce((s, d) => s + d.value, 0));
const pieGradient = computed(() => {
  if (!pieTotal.value) return "conic-gradient(#e5e7eb 0deg 360deg)";
  let acc = 0;
  const parts: string[] = [];
  eventStatusData.value.forEach((d) => {
    const start = (acc / pieTotal.value) * 360;
    acc += d.value;
    const end = (acc / pieTotal.value) * 360;
    parts.push(`${d.color} ${start}deg ${end}deg`);
  });
  return `conic-gradient(${parts.join(", ")})`;
});
</script>

<template>
  <div class="dash-analytics space-y-3 sm:space-y-4">
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <div class="w-9 h-9 rounded-xl bg-[#16A34A] flex items-center justify-center shadow shrink-0">
        <BarChart2 :size="18" class="text-white" />
      </div>
      <div class="min-w-0">
        <h1 class="font-bold text-gray-800 text-base">Analytics Overview</h1>
        <p class="text-gray-500 text-xs">Dean portal · Live analytics</p>
      </div>
      <div
        class="sm:ml-auto flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm w-fit"
      >
        <TrendingUp :size="14" class="text-[#16A34A]" />
        <span class="text-xs font-semibold text-gray-700">Peak: {{ peakMonthLabel }}</span>
      </div>
    </div>
    <p v-if="analyticsError" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      Live analytics unavailable: {{ analyticsError }}
    </p>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div
        v-for="card in statCards"
        :key="card.label"
        :class="[card.bg, 'rounded-xl p-4 border border-gray-100 shadow-sm']"
      >
        <div class="flex items-start justify-between mb-3">
          <div
            class="w-9 h-9 rounded-lg flex items-center justify-center"
            :style="{ backgroundColor: card.accent + '22' }"
          >
            <component :is="card.icon" :size="18" :style="{ color: card.accent }" />
          </div>
          <span
            :class="[
              'text-[10px] font-bold px-2 py-0.5 rounded-full',
              card.changePositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
            ]"
          >
            {{ card.changePositive ? "▲" : "▼" }}
          </span>
        </div>
        <div class="font-bold text-2xl text-gray-800 mb-0.5">{{ card.value }}</div>
        <div class="text-xs font-semibold text-gray-600 mb-1">{{ card.label }}</div>
        <div class="text-[10px] text-gray-400">{{ card.change }}</div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div class="mb-4">
        <h3 class="font-bold text-gray-800 text-sm">Event Status Overview</h3>
          <p class="text-gray-400 text-xs">All time · {{ totals.allTimeCount }} events</p>
      </div>
      <div class="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
        <div class="shrink-0 flex justify-center w-full sm:w-[40%] max-w-[200px]">
          <div
            class="w-44 h-44 sm:w-48 sm:h-48 rounded-full border border-gray-100 shadow-inner relative"
            :style="{
              background: pieGradient,
              mask: 'radial-gradient(transparent 58%, black 59%)',
              WebkitMask: 'radial-gradient(transparent 58%, black 59%)',
            }"
            role="img"
            aria-label="Event status distribution"
          />
        </div>
        <div class="flex-1 w-full space-y-3 min-w-0">
          <div v-for="item in eventStatusData" :key="item.name" class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <div class="w-4 h-4 rounded shrink-0" :style="{ backgroundColor: item.color }" />
              <span class="text-sm font-medium text-gray-700 truncate">{{ item.name }}</span>
            </div>
            <span class="text-lg font-bold text-gray-800 shrink-0">{{ item.value }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div class="flex items-center justify-between mb-4 gap-2">
        <div>
          <h3 class="font-bold text-gray-800 text-sm">Recent Activity</h3>
          <p class="text-gray-400 text-xs">Latest event actions</p>
        </div>
        <ViewAllDashboardButton to="/dean" />
      </div>
      <div class="space-y-3">
        <div
          v-for="item in recentActivity"
          :key="item.id"
          class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition"
        >
          <div class="text-lg w-8 text-center shrink-0">{{ item.icon }}</div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold text-gray-800 truncate">{{ item.event }}</div>
            <div class="text-xs text-gray-400">{{ item.org }}</div>
          </div>
          <div class="text-right shrink-0">
            <span
              :class="[
                'text-[10px] font-bold px-2 py-0.5 rounded-full',
                item.action === 'Approved'
                  ? 'bg-green-100 text-green-700'
                  : item.action === 'Rejected'
                    ? 'bg-red-100 text-red-700'
                    : item.action === 'Pending'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-blue-100 text-blue-700',
              ]"
            >
              {{ item.action }}
            </span>
            <div class="text-[10px] text-gray-400 mt-0.5">{{ item.time }}</div>
          </div>
        </div>
        <p v-if="!recentActivity.length" class="text-center text-xs text-gray-500 py-4">No recent activity yet.</p>
      </div>
    </div>

    <div class="h-4" />
  </div>
</template>
