<script setup lang="ts">
import { computed } from "vue";
import {
  TrendingUp,
  CalendarDays,
  CheckCircle2,
  BarChart2,
  Clock,
  AlertTriangle,
} from "lucide-vue-next";
import EventsLogPanel from "@/components/portal/EventsLogPanel.vue";
import ViewAllDashboardButton from "@/components/portal/ViewAllDashboardButton.vue";
import PortalStatSkeleton from "@/components/portal/PortalStatSkeleton.vue";
import AnalyticsMonthFilter from "@/components/portal/AnalyticsMonthFilter.vue";
import AnalyticsRecordsModal from "@/components/portal/AnalyticsRecordsModal.vue";
import { useAnalyticsDashboard } from "@/composables/useAnalyticsDashboard";

const {
  period,
  data,
  loading: analyticsLoading,
  error: analyticsError,
  monthLabel,
  canNextMonth,
  topOrganizations,
  topColleges,
  drilldown,
  setPeriod,
  shiftMonth,
  closeDrilldown,
  openOrganizations,
  openColleges,
  openStatus,
  openAllEvents,
  selectSummaryRow,
} = useAnalyticsDashboard("eo");

const monthlyEvents = computed(() => data.value.monthlyEvents);
const eventStatusData = computed(() => data.value.eventStatusData);
const organizationData = topOrganizations;
const collegeData = topColleges;
const recentActivity = computed(() => data.value.recentActivity);
const totals = computed(() => data.value.totals);
const peakMonthLabel = computed(() => data.value.peakMonthLabel);

const maxOrgEvents = computed(() => Math.max(...organizationData.value.map((o) => o.events), 1));
const maxCollegeEvents = computed(() => Math.max(...collegeData.value.map((c) => c.events), 1));

const approvedDelta = computed(() => totals.value.approvedThisMonth - totals.value.approvedLastMonth);

const statCards = computed(() => [
  {
    label: `Events in ${monthLabel.value}`,
    value: String(totals.value.totalThisYear),
    change: "Click to view all records",
    changePositive: true,
    icon: CalendarDays,
    accent: "#16A34A",
    bg: "bg-green-50",
    onClick: openAllEvents,
  },
  {
    label: "Approved This Month",
    value: String(totals.value.approvedThisMonth),
    change:
      approvedDelta.value >= 0
        ? `+${approvedDelta.value} vs last month`
        : `${approvedDelta.value} vs last month`,
    changePositive: approvedDelta.value >= 0,
    icon: CheckCircle2,
    accent: "#4ADE80",
    bg: "bg-emerald-50",
    onClick: openAllEvents,
  },
  {
    label: "Pending This Month",
    value: String(totals.value.pendingCount),
    change: "In selected month",
    changePositive: false,
    icon: Clock,
    accent: "#F59E0B",
    bg: "bg-yellow-50",
    onClick: openStatus,
  },
  {
    label: "Awaiting Publish",
    value: String(totals.value.awaitingPublishCount),
    change: "EO publish queue this month",
    changePositive: false,
    icon: AlertTriangle,
    accent: "#DC2626",
    bg: "bg-red-50",
    onClick: openAllEvents,
  },
]);

const chartW = 400;
const chartH = 200;
const pad = 32;
const maxY = computed(() => Math.max(1, ...monthlyEvents.value.map((d) => d.events)));

const linePoints = computed(() => {
  const n = monthlyEvents.value.length;
  const x = (i: number) => pad + (n === 1 ? 0 : (i / (n - 1)) * (chartW - 2 * pad));
  const y = (v: number) => chartH - pad - (v / maxY.value) * (chartH - 2 * pad);
  const eventsPts = monthlyEvents.value.map((d, i) => `${x(i)},${y(d.events)}`).join(" ");
  const approvedPts = monthlyEvents.value.map((d, i) => `${x(i)},${y(d.approved)}`).join(" ");
  return { eventsPts, approvedPts };
});

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
        <h1 class="font-bold text-gray-800 text-base">Dashboard</h1>
        <p class="text-gray-500 text-xs">Executive Officer portal · Reports &amp; analytics</p>
      </div>
      <div class="sm:ml-auto flex flex-wrap items-center gap-2">
        <AnalyticsMonthFilter
          :period="period"
          :can-next="canNextMonth"
          @update:period="setPeriod"
          @shift="shiftMonth"
        />
        <div class="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 shadow-sm">
          <TrendingUp :size="14" class="text-[#16A34A]" />
          <span class="text-xs font-semibold text-gray-700">Peak: {{ peakMonthLabel }}</span>
        </div>
      </div>
    </div>

    <p v-if="analyticsError" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      Live analytics unavailable: {{ analyticsError }}
    </p>

    <PortalStatSkeleton v-if="analyticsLoading" :count="4" />
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <div
        v-for="card in statCards"
        :key="card.label"
        :class="[card.bg, 'rounded-xl p-4 border border-gray-100 shadow-sm cursor-pointer hover:ring-1 hover:ring-emerald-200']"
        @click="card.onClick()"
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

    <div class="grid grid-cols-1 lg:grid-cols-4 gap-3">
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div class="flex items-center justify-between mb-4 gap-2">
          <div>
            <h3 class="font-bold text-gray-800 text-sm">Recent Activity</h3>
            <p class="text-gray-400 text-xs">Latest event actions</p>
          </div>
          <ViewAllDashboardButton to="/executive-officer" />
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

      <div class="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
          <div>
            <h3 class="font-bold text-gray-800 text-sm">Monthly Event Trend</h3>
            <p class="text-gray-400 text-xs">Last 6 months through {{ monthLabel }}</p>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-1.5">
              <div class="w-3 h-0.5 bg-[#16A34A] rounded" />
              <span class="text-[10px] text-gray-500">Total</span>
            </div>
            <div class="flex items-center gap-1.5">
              <div class="w-3 h-0.5 bg-[#4ADE80] rounded" />
              <span class="text-[10px] text-gray-500">Approved</span>
            </div>
          </div>
        </div>
        <svg :viewBox="`0 0 ${chartW} ${chartH}`" class="w-full h-[200px]" role="img" aria-label="Monthly event trend">
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
          <polyline fill="none" stroke="#16A34A" stroke-width="2.5" :points="linePoints.eventsPts" />
          <g v-for="(d, i) in monthlyEvents" :key="d.id">
            <circle
              :cx="pad + (monthlyEvents.length === 1 ? 0 : (i / (monthlyEvents.length - 1)) * (chartW - 2 * pad))"
              :cy="chartH - pad - (d.events / maxY) * (chartH - 2 * pad)"
              r="4"
              fill="#16A34A"
              stroke="white"
              stroke-width="2"
            />
          </g>
          <polyline fill="none" stroke="#4ADE80" stroke-width="2" stroke-dasharray="4 2" :points="linePoints.approvedPts" />
          <g v-for="(d, i) in monthlyEvents" :key="'a-' + d.id">
            <circle
              :cx="pad + (monthlyEvents.length === 1 ? 0 : (i / (monthlyEvents.length - 1)) * (chartW - 2 * pad))"
              :cy="chartH - pad - (d.approved / maxY) * (chartH - 2 * pad)"
              r="3"
              fill="#4ADE80"
              stroke="white"
              stroke-width="2"
            />
          </g>
          <g fill="#9CA3AF" font-size="11" text-anchor="middle">
            <text
              v-for="(d, i) in monthlyEvents"
              :key="'t-' + d.id"
              :x="pad + (monthlyEvents.length === 1 ? 0 : (i / (monthlyEvents.length - 1)) * (chartW - 2 * pad))"
              :y="chartH - 8"
            >
              {{ d.month }}
            </text>
          </g>
        </svg>
      </div>

      <button
        type="button"
        class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-left hover:ring-1 hover:ring-emerald-200"
        @click="openStatus"
      >
        <div class="mb-4">
          <h3 class="font-bold text-gray-800 text-sm">Event Status</h3>
          <p class="text-gray-400 text-xs">{{ monthLabel }} · {{ totals.allTimeCount }} events · click to view all</p>
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
          <div v-for="item in eventStatusData" :key="item.name" class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <div class="w-2.5 h-2.5 rounded-sm" :style="{ backgroundColor: item.color }" />
              <span class="text-xs text-gray-600">{{ item.name }}</span>
            </div>
            <span class="text-xs font-bold text-gray-700">{{ item.value }}</span>
          </div>
        </div>
      </button>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
      <button
        type="button"
        class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-left hover:ring-1 hover:ring-emerald-200"
        @click="openOrganizations"
      >
        <div class="mb-4">
          <h3 class="font-bold text-gray-800 text-sm">Events by Organization</h3>
          <p class="text-gray-400 text-xs">
            {{ monthLabel }} · Top {{ organizationData.length || 0 }} · click for all organizations
          </p>
        </div>
        <div class="space-y-3">
          <div v-for="row in organizationData" :key="row.org">
            <div class="flex justify-between text-xs text-gray-600 mb-1">
              <span class="font-semibold text-gray-800 truncate pr-2">{{ row.org }}</span>
              <span>{{ row.events }}</span>
            </div>
            <div class="h-6 bg-gray-100 rounded overflow-hidden">
              <div
                class="h-full bg-[#16A34A] rounded-r transition-all"
                :style="{ width: `${(row.events / maxOrgEvents) * 100}%` }"
              />
            </div>
          </div>
          <p v-if="!organizationData.length" class="py-4 text-center text-xs text-gray-400">No organization data this month.</p>
        </div>
      </button>
      <button
        type="button"
        class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-left hover:ring-1 hover:ring-emerald-200"
        @click="openColleges"
      >
        <div class="mb-4">
          <h3 class="font-bold text-gray-800 text-sm">Events by College</h3>
          <p class="text-gray-400 text-xs">
            {{ monthLabel }} · Top {{ collegeData.length || 0 }} · click for all colleges
          </p>
        </div>
        <div class="space-y-3">
          <div v-for="row in collegeData" :key="row.college">
            <div class="flex justify-between text-xs text-gray-600 mb-1">
              <span class="font-semibold text-gray-800 truncate pr-2">{{ row.college }}</span>
              <span>{{ row.events }}</span>
            </div>
            <div class="h-6 bg-gray-100 rounded overflow-hidden">
              <div
                class="h-full bg-[#059669] rounded-r transition-all"
                :style="{ width: `${(row.events / maxCollegeEvents) * 100}%` }"
              />
            </div>
          </div>
          <p v-if="!collegeData.length" class="py-4 text-center text-xs text-gray-400">No college data this month.</p>
        </div>
      </button>
    </div>

    <EventsLogPanel role="eo" />
    <AnalyticsRecordsModal :drilldown="drilldown" @close="closeDrilldown" @select="selectSummaryRow" />

    <div class="h-4" />
  </div>
</template>
