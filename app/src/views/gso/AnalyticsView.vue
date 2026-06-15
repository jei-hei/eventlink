<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { TrendingUp, BarChart2 } from "lucide-vue-next";
import ViewAllDashboardButton from "@/components/portal/ViewAllDashboardButton.vue";
import { fetchAnalyticsOverview } from "@/services/analyticsDb";

type MonthlyBorrowedItem = { id: string; month: string; chairs: number; tables: number; soundSystem: number };

const monthlyBorrowedItems = ref<MonthlyBorrowedItem[]>([
  { id: "m1", month: "Jan", chairs: 0, tables: 0, soundSystem: 0 },
]);
const venueRequestData = ref<{ name: string; value: number; color: string }[]>([]);
const recentActivity = ref<{ id: number; action: string; event: string; time: string; org: string; icon: string }[]>([]);
const totals = ref({ allTimeCount: 0 });
const peakMonthLabel = ref("No data yet");
const analyticsError = ref<string | null>(null);

const COLORS = ["#16A34A", "#4ADE80", "#84CC16", "#22C55E", "#0EA5E9", "#6366F1"];

async function loadAnalytics() {
  try {
    const data = await fetchAnalyticsOverview("gso");
    monthlyBorrowedItems.value = data.monthlyEvents.map((m) => ({
      id: m.id,
      month: m.month,
      chairs: m.events,
      tables: m.approved,
      soundSystem: m.rejected,
    }));
    venueRequestData.value = data.organizationData.map((o, idx) => ({
      name: o.org,
      value: o.events,
      color: COLORS[idx % COLORS.length]!,
    }));
    recentActivity.value = data.recentActivity;
    totals.value = { allTimeCount: data.totals.allTimeCount };
    peakMonthLabel.value = data.peakMonthLabel;
  } catch (e) {
    analyticsError.value = e instanceof Error ? e.message : "Could not load analytics.";
  }
}

onMounted(() => {
  void loadAnalytics();
});

const chartW = 400;
const chartH = 200;
const pad = 32;
const maxY = computed(() => Math.max(1, ...monthlyBorrowedItems.value.map((d) => d.chairs)));

const linePoints = computed(() => {
  const n = monthlyBorrowedItems.value.length;
  const x = (i: number) => pad + (n === 1 ? 0 : (i / (n - 1)) * (chartW - 2 * pad));
  const y = (v: number) => chartH - pad - (v / maxY.value) * (chartH - 2 * pad);
  return {
    chairs: monthlyBorrowedItems.value.map((d, i) => `${x(i)},${y(d.chairs)}`).join(" "),
    tables: monthlyBorrowedItems.value.map((d, i) => `${x(i)},${y(d.tables)}`).join(" "),
    sound: monthlyBorrowedItems.value.map((d, i) => `${x(i)},${y(d.soundSystem)}`).join(" "),
  };
});

const pieTotal = computed(() => venueRequestData.value.reduce((s, d) => s + d.value, 0));

const pieGradient = computed(() => {
  if (!pieTotal.value) return "conic-gradient(#e5e7eb 0deg 360deg)";
  let acc = 0;
  const parts: string[] = [];
  venueRequestData.value.forEach((d) => {
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
        <p class="text-gray-500 text-xs">GSO portal · Live analytics</p>
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

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div class="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
          <div>
            <h3 class="font-bold text-gray-800 text-sm">Monthly Request Volume</h3>
            <p class="text-gray-400 text-xs">Last 6 months</p>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <div class="flex items-center gap-1.5">
              <div class="w-3 h-0.5 bg-[#16A34A] rounded" />
              <span class="text-[10px] text-gray-500">Total</span>
            </div>
            <div class="flex items-center gap-1.5">
              <div class="w-3 h-0.5 bg-[#4ADE80] rounded" />
              <span class="text-[10px] text-gray-500">Approved</span>
            </div>
            <div class="flex items-center gap-1.5">
              <div class="w-3 h-0.5 bg-[#F59E0B] rounded" />
              <span class="text-[10px] text-gray-500">Rejected</span>
            </div>
          </div>
        </div>
        <svg :viewBox="`0 0 ${chartW} ${chartH}`" class="w-full h-[200px]" role="img" aria-label="Monthly borrowed items">
          <rect width="100%" height="100%" fill="white" />
          <g stroke="#F3F4F6" stroke-width="1">
            <line
              v-for="i in 5"
              :key="i"
              :x1="pad"
              :y1="pad + ((i - 1) / 4) * (chartH - 2 * pad)"
              :x2="chartW - pad"
              :y2="pad + ((i - 1) / 4) * (chartH - 2 * pad)"
            />
          </g>
          <polyline fill="none" stroke="#16A34A" stroke-width="2.5" :points="linePoints.chairs" />
          <polyline fill="none" stroke="#4ADE80" stroke-width="2" :points="linePoints.tables" />
          <polyline fill="none" stroke="#F59E0B" stroke-width="2" stroke-dasharray="4 2" :points="linePoints.sound" />
          <g v-for="(d, i) in monthlyBorrowedItems" :key="d.id">
            <circle
              :cx="pad + (monthlyBorrowedItems.length === 1 ? 0 : (i / (monthlyBorrowedItems.length - 1)) * (chartW - 2 * pad))"
              :cy="chartH - pad - (d.chairs / maxY) * (chartH - 2 * pad)"
              r="4"
              fill="#16A34A"
              stroke="white"
              stroke-width="2"
            />
          </g>
          <g v-for="(d, i) in monthlyBorrowedItems" :key="'t-' + d.id">
            <circle
              :cx="pad + (monthlyBorrowedItems.length === 1 ? 0 : (i / (monthlyBorrowedItems.length - 1)) * (chartW - 2 * pad))"
              :cy="chartH - pad - (d.tables / maxY) * (chartH - 2 * pad)"
              r="3"
              fill="#4ADE80"
              stroke="white"
              stroke-width="2"
            />
          </g>
          <g v-for="(d, i) in monthlyBorrowedItems" :key="'s-' + d.id">
            <circle
              :cx="pad + (monthlyBorrowedItems.length === 1 ? 0 : (i / (monthlyBorrowedItems.length - 1)) * (chartW - 2 * pad))"
              :cy="chartH - pad - (d.soundSystem / maxY) * (chartH - 2 * pad)"
              r="3"
              fill="#F59E0B"
              stroke="white"
              stroke-width="2"
            />
          </g>
          <g fill="#9CA3AF" font-size="11" text-anchor="middle">
            <text
              v-for="(d, i) in monthlyBorrowedItems"
              :key="'lbl-' + d.id"
              :x="pad + (monthlyBorrowedItems.length === 1 ? 0 : (i / (monthlyBorrowedItems.length - 1)) * (chartW - 2 * pad))"
              :y="chartH - 8"
            >
              {{ d.month }}
            </text>
          </g>
        </svg>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div class="mb-4">
          <h3 class="font-bold text-gray-800 text-sm">Top Organizations by Requests</h3>
          <p class="text-gray-400 text-xs">All time · {{ totals.allTimeCount }} requests</p>
        </div>
        <div class="flex items-center justify-center py-2">
          <div
            class="w-36 h-36 rounded-full border border-gray-100 shadow-inner relative"
            :style="{
              background: pieGradient,
              mask: 'radial-gradient(transparent 52%, black 53%)',
              WebkitMask: 'radial-gradient(transparent 52%, black 53%)',
            }"
            aria-hidden="true"
          />
        </div>
        <div class="mt-2 space-y-1.5">
          <div v-for="item in venueRequestData" :key="item.name" class="flex items-center justify-between">
            <div class="flex items-center gap-1.5 min-w-0">
              <div class="w-2.5 h-2.5 rounded-sm shrink-0" :style="{ backgroundColor: item.color }" />
              <span class="text-xs text-gray-600 truncate">{{ item.name }}</span>
            </div>
            <span class="text-xs font-bold text-gray-700 shrink-0">{{ item.value }}</span>
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
        <ViewAllDashboardButton to="/gso" />
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
