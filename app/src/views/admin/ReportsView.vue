<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import {
  Download,
  TrendingUp,
  Users,
  GraduationCap,
  CalendarDays,
  Building2,
  CheckCircle2,
  Clock,
  XCircle,
  Ban,
  Wrench,
  MapPin,
} from "lucide-vue-next";
import { useStudentRegistryStore } from "@/stores/studentRegistry";
import { useUiStore } from "@/stores/ui";
import { downloadCsv } from "@/utils/downloadCsv";
import { normalizeStudentId } from "@/types/studentRegistry";
import { APP_ROLES, APP_ROLE_LABEL } from "@/types/appRole";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  defaultAdminReportFilters,
  fetchAdminReportsData,
  type AdminReportFilters,
  type AdminReportsData,
  type NameCount,
} from "@/services/adminReportsDb";

const registry = useStudentRegistryStore();
const ui = useUiStore();

const loading = ref(false);
const loadError = ref<string | null>(null);
const filters = reactive<AdminReportFilters>(defaultAdminReportFilters());

const reports = ref<AdminReportsData | null>(null);

const studentsByCollege = computed(() => {
  const collegeMap = new Map<string, number>();
  registry.students
    .filter((s) => !s.archived)
    .forEach((s) => {
      const name = s.course?.trim() || "Unassigned";
      collegeMap.set(name, (collegeMap.get(name) ?? 0) + 1);
    });
  return Array.from(collegeMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
});

const usersByRole = computed(() => reports.value?.userStats.byRole ?? []);

onMounted(() => {
  if (registry.useSupabase) {
    registry.fetchAll().catch(() => {
      /* optional load */
    });
  }
});

watch(
  () => ({ ...filters }),
  () => {
    void loadReportData();
  },
  { immediate: true },
);

async function loadReportData() {
  if (!isSupabaseConfigured) return;
  loading.value = true;
  loadError.value = null;
  try {
    reports.value = await fetchAdminReportsData({ ...filters });
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : typeof e === "object" && e && "message" in e
          ? String((e as { message: unknown }).message)
          : "Could not load reports.";
    loadError.value = msg;
  } finally {
    loading.value = false;
  }
}

function clearFilters() {
  Object.assign(filters, defaultAdminReportFilters());
}

function exportStudentRegistry() {
  const rows = registry.students.filter((s) => !s.archived);
  if (!rows.length) {
    ui.pushToast("No data", "Import students under Admin → Students first.", "warning");
    return;
  }
  downloadCsv("student-registry.csv", [
    ["Student ID", "Full Name", "College", "Program", "Email"],
    ...rows.map((s) => [
      normalizeStudentId(s.studentId),
      s.fullName,
      s.course,
      s.program,
      s.email ?? "",
    ]),
  ]);
  ui.pushToast("Downloaded", `${rows.length} student row(s) exported.`, "success");
}

function exportUsersByRole() {
  if (!usersByRole.value.length) {
    ui.pushToast("No data", "No users to export yet.", "warning");
    return;
  }
  downloadCsv("users-by-role.csv", [
    ["Role", "Count"],
    ...usersByRole.value.map((r) => [r.name, String(r.count)]),
  ]);
  ui.pushToast("Downloaded", "users-by-role.csv generated.", "success");
}

function exportCollegeStats() {
  if (!studentsByCollege.value.length) {
    ui.pushToast("No data", "No college statistics available.", "warning");
    return;
  }
  downloadCsv("college-statistics.csv", [
    ["College", "Students"],
    ...studentsByCollege.value.map((r) => [r.name, String(r.value)]),
  ]);
  ui.pushToast("Downloaded", "college-statistics.csv generated.", "success");
}

function exportDetailReport() {
  const rows = reports.value?.detailRows ?? [];
  if (!rows.length) {
    ui.pushToast("No data", "No event rows match the current filters.", "warning");
    return;
  }
  downloadCsv("event-detail-report.csv", [
    ["Event", "Organization", "College", "Requester", "Date", "Venue", "Status"],
    ...rows.map((r) => [r.event, r.organization, r.college, r.requester, r.date, r.venue, r.status]),
  ]);
  ui.pushToast("Downloaded", `${rows.length} event row(s) exported.`, "success");
}

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

const eventStatCards = computed(() => {
  const e = reports.value?.eventStats;
  return [
    { label: "Total Events", value: e?.total ?? 0, icon: CalendarDays },
    { label: "Scheduled / Approved", value: e?.scheduledOrApproved ?? 0, icon: CheckCircle2 },
    { label: "Pending Events", value: e?.pending ?? 0, icon: Clock },
    { label: "Declined Events", value: e?.declined ?? 0, icon: XCircle },
    { label: "Cancelled Events", value: e?.cancelled ?? 0, icon: Ban },
  ];
});

const userStatCards = computed(() => {
  const u = reports.value?.userStats;
  return [
    { label: "Total Users", value: u?.total ?? 0, icon: Users },
    { label: "Active Users", value: u?.active ?? 0, icon: TrendingUp },
    { label: "Inactive Users", value: u?.inactive ?? 0, icon: GraduationCap },
  ];
});

const orgStatCards = computed(() => [
  {
    label: "Total Organizations",
    value: reports.value?.organizationStats.total ?? 0,
    icon: Building2,
  },
]);

const approvalStatCards = computed(() => {
  const a = reports.value?.approvalStats;
  return [
    { label: "Pending Approvals", value: a?.pending ?? 0 },
    { label: "Approved Requests", value: a?.approved ?? 0 },
    { label: "Declined Requests", value: a?.declined ?? 0 },
    { label: "Revision Requests", value: a?.revision ?? 0 },
  ];
});

const maxRoleCount = computed(() => Math.max(...usersByRole.value.map((r) => r.count), 1));
const maxUserCollege = computed(() =>
  Math.max(...(reports.value?.userStats.byCollege.map((r) => r.count) ?? [0]), 1),
);
const maxOrgEvents = computed(() =>
  Math.max(...(reports.value?.organizationStats.eventsByOrganization.map((r) => r.count) ?? [0]), 1),
);
const maxCollegeEvents = computed(() =>
  Math.max(...(reports.value?.organizationStats.eventsByCollege.map((r) => r.count) ?? [0]), 1),
);

const pieTotal = computed(() => studentsByCollege.value.reduce((s, c) => s + c.value, 0));
const pieLegend = computed(() =>
  studentsByCollege.value.map((c, i) => ({
    ...c,
    color: COLORS[i % COLORS.length]!,
    pct: pieTotal.value ? Math.round((c.value / pieTotal.value) * 100) : 0,
  })),
);
const pieGradient = computed(() => {
  if (!pieTotal.value) return "conic-gradient(#e5e7eb 0deg 360deg)";
  let acc = 0;
  const parts: string[] = [];
  studentsByCollege.value.forEach((c, i) => {
    const start = (acc / pieTotal.value) * 360;
    acc += c.value;
    const end = (acc / pieTotal.value) * 360;
    parts.push(`${COLORS[i % COLORS.length]!} ${start}deg ${end}deg`);
  });
  return `conic-gradient(${parts.join(", ")})`;
});

const organizationOptions = computed(() => {
  const all = reports.value?.filterOptions.organizations ?? [];
  if (!filters.collegeId) return all;
  return all.filter((o) => o.collegeId === filters.collegeId);
});

watch(
  () => filters.collegeId,
  () => {
    if (
      filters.organizationId &&
      !organizationOptions.value.some((o) => o.id === filters.organizationId)
    ) {
      filters.organizationId = "";
    }
  },
);

function barWidth(count: number, max: number): string {
  return `${Math.max(4, (count / Math.max(max, 1)) * 100)}%`;
}

function countList(items: NameCount[] | undefined): NameCount[] {
  return items ?? [];
}
</script>

<template>
  <div class="p-8">
    <div class="mb-8">
      <h1 class="mb-2 text-3xl font-semibold text-gray-900">Reports & Analytics</h1>
      <p class="text-gray-600">System-wide EventLink statistics, filters, and detailed event reports.</p>
    </div>

    <p
      v-if="loadError"
      class="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
    >
      {{ loadError }}
    </p>

    <!-- Filters -->
    <div class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Filters</h2>
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          @click="clearFilters"
        >
          Clear filters
        </button>
      </div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Date from</label>
          <input v-model="filters.dateFrom" type="date" class="input-dash w-full py-2" />
        </div>
        <div>
          <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Date to</label>
          <input v-model="filters.dateTo" type="date" class="input-dash w-full py-2" />
        </div>
        <div>
          <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">College</label>
          <select v-model="filters.collegeId" class="input-dash w-full py-2">
            <option value="">All colleges</option>
            <option
              v-for="c in reports?.filterOptions.colleges ?? []"
              :key="c.id"
              :value="c.id"
            >
              {{ c.name }}
            </option>
          </select>
        </div>
        <div>
          <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Organization</label>
          <select v-model="filters.organizationId" class="input-dash w-full py-2">
            <option value="">All organizations</option>
            <option v-for="o in organizationOptions" :key="o.id" :value="o.id">{{ o.name }}</option>
          </select>
        </div>
        <div>
          <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Event status</label>
          <select v-model="filters.status" class="input-dash w-full py-2">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="posted">Posted / Scheduled</option>
            <option value="declined">Declined</option>
            <option value="cancelled">Cancelled</option>
            <option value="revision_requested">Revision requested</option>
          </select>
        </div>
        <div>
          <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Event type</label>
          <select v-model="filters.requestType" class="input-dash w-full py-2">
            <option value="">All types</option>
            <option value="student_officer">Student Officer</option>
            <option value="ssc">SSC</option>
            <option value="eo_direct">EO Direct</option>
          </select>
        </div>
        <div>
          <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Requester role</label>
          <select v-model="filters.role" class="input-dash w-full py-2">
            <option value="">All roles</option>
            <option v-for="role in APP_ROLES" :key="role" :value="role">
              {{ APP_ROLE_LABEL[role] }}
            </option>
          </select>
        </div>
        <div>
          <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Responsible office
          </label>
          <select v-model="filters.responsibleOffice" class="input-dash w-full py-2">
            <option value="">All offices</option>
            <option value="gso">GSO</option>
            <option value="it_infrastructure">IT Infrastructure</option>
            <option value="sports_office">Sports Office</option>
            <option value="ssc">SSC</option>
          </select>
        </div>
      </div>
      <p v-if="loading" class="mt-3 text-sm text-slate-500">Refreshing analytics…</p>
    </div>

    <!-- Event statistics -->
    <h2 class="mb-3 text-lg font-semibold text-gray-900">Event Statistics</h2>
    <div class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <div
        v-for="stat in eventStatCards"
        :key="stat.label"
        class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
      >
        <div class="mb-3 flex items-center justify-between">
          <component :is="stat.icon" class="h-7 w-7 text-blue-600" />
        </div>
        <p class="mb-1 text-sm text-gray-600">{{ stat.label }}</p>
        <p class="text-2xl font-semibold text-gray-900">{{ stat.value }}</p>
      </div>
    </div>

    <!-- User statistics -->
    <h2 class="mb-3 text-lg font-semibold text-gray-900">User Statistics</h2>
    <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
      <div
        v-for="stat in userStatCards"
        :key="stat.label"
        class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
      >
        <div class="mb-3 flex items-center justify-between">
          <component :is="stat.icon" class="h-7 w-7 text-blue-600" />
          <span class="text-sm text-green-600">Live</span>
        </div>
        <p class="mb-1 text-sm text-gray-600">{{ stat.label }}</p>
        <p class="text-2xl font-semibold text-gray-900">{{ stat.value }}</p>
      </div>
    </div>

    <div class="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div class="mb-6 flex items-center justify-between gap-3">
          <h3 class="text-lg font-semibold text-gray-900">Users by Role</h3>
          <button
            type="button"
            class="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-700"
            @click="exportUsersByRole"
          >
            <Download class="h-4 w-4" />
            Export
          </button>
        </div>
        <div v-if="loading && !usersByRole.length" class="flex min-h-[220px] items-center justify-center text-sm text-gray-500">
          Loading…
        </div>
        <div v-else-if="!usersByRole.length" class="flex min-h-[220px] items-center justify-center text-sm text-gray-500">
          No role data yet.
        </div>
        <div v-else class="flex min-h-[220px] flex-col justify-center space-y-4">
          <div v-for="row in usersByRole" :key="row.name" class="space-y-1">
            <div class="flex justify-between text-sm">
              <span class="truncate pr-2 font-medium text-gray-700">{{ row.name }}</span>
              <span class="shrink-0 text-gray-600">{{ row.count }}</span>
            </div>
            <div class="h-3 overflow-hidden rounded-full bg-gray-100">
              <div
                class="h-full rounded-full bg-blue-500 transition-all"
                :style="{ width: barWidth(row.count, maxRoleCount) }"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 class="mb-6 text-lg font-semibold text-gray-900">Users by College</h3>
        <div
          v-if="!(reports?.userStats.byCollege.length)"
          class="flex min-h-[220px] items-center justify-center text-sm text-gray-500"
        >
          No college user data yet.
        </div>
        <div v-else class="flex min-h-[220px] flex-col justify-center space-y-4">
          <div
            v-for="row in reports?.userStats.byCollege ?? []"
            :key="row.name"
            class="space-y-1"
          >
            <div class="flex justify-between text-sm">
              <span class="truncate pr-2 font-medium text-gray-700">{{ row.name }}</span>
              <span class="shrink-0 text-gray-600">{{ row.count }}</span>
            </div>
            <div class="h-3 overflow-hidden rounded-full bg-gray-100">
              <div
                class="h-full rounded-full bg-emerald-500 transition-all"
                :style="{ width: barWidth(row.count, maxUserCollege) }"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Organization statistics -->
    <h2 class="mb-3 text-lg font-semibold text-gray-900">Organization Statistics</h2>
    <div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
      <div
        v-for="stat in orgStatCards"
        :key="stat.label"
        class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
      >
        <component :is="stat.icon" class="mb-3 h-7 w-7 text-blue-600" />
        <p class="mb-1 text-sm text-gray-600">{{ stat.label }}</p>
        <p class="text-2xl font-semibold text-gray-900">{{ stat.value }}</p>
      </div>
    </div>
    <div class="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 class="mb-4 text-lg font-semibold text-gray-900">Events by Organization</h3>
        <div
          v-if="!countList(reports?.organizationStats.eventsByOrganization).length"
          class="py-8 text-center text-sm text-gray-500"
        >
          No organization events yet.
        </div>
        <div v-else class="space-y-3">
          <div
            v-for="row in countList(reports?.organizationStats.eventsByOrganization)"
            :key="row.name"
            class="space-y-1"
          >
            <div class="flex justify-between text-sm">
              <span class="truncate pr-2 text-gray-700">{{ row.name }}</span>
              <span class="text-gray-600">{{ row.count }}</span>
            </div>
            <div class="h-2.5 overflow-hidden rounded-full bg-gray-100">
              <div class="h-full rounded-full bg-blue-500" :style="{ width: barWidth(row.count, maxOrgEvents) }" />
            </div>
          </div>
        </div>
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 class="mb-4 text-lg font-semibold text-gray-900">Events by College</h3>
        <div
          v-if="!countList(reports?.organizationStats.eventsByCollege).length"
          class="py-8 text-center text-sm text-gray-500"
        >
          No college events yet.
        </div>
        <div v-else class="space-y-3">
          <div
            v-for="row in countList(reports?.organizationStats.eventsByCollege)"
            :key="row.name"
            class="space-y-1"
          >
            <div class="flex justify-between text-sm">
              <span class="truncate pr-2 text-gray-700">{{ row.name }}</span>
              <span class="text-gray-600">{{ row.count }}</span>
            </div>
            <div class="h-2.5 overflow-hidden rounded-full bg-gray-100">
              <div
                class="h-full rounded-full bg-emerald-500"
                :style="{ width: barWidth(row.count, maxCollegeEvents) }"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Approval statistics -->
    <h2 class="mb-3 text-lg font-semibold text-gray-900">Approval Statistics</h2>
    <div class="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div
        v-for="stat in approvalStatCards"
        :key="stat.label"
        class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
      >
        <p class="mb-1 text-sm text-gray-600">{{ stat.label }}</p>
        <p class="text-2xl font-semibold text-gray-900">{{ stat.value }}</p>
      </div>
    </div>
    <div class="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 class="mb-4 text-lg font-semibold text-gray-900">Requests handled by office</h3>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="row in countList(reports?.approvalStats.byOffice)"
          :key="row.name"
          class="rounded-lg border border-gray-100 bg-slate-50 px-4 py-3"
        >
          <p class="text-sm text-gray-600">{{ row.name }}</p>
          <p class="text-xl font-semibold text-gray-900">{{ row.count }}</p>
        </div>
      </div>
    </div>

    <!-- Resource statistics -->
    <h2 class="mb-3 text-lg font-semibold text-gray-900">Resource Statistics</h2>
    <div class="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div class="mb-4 flex items-center gap-2">
          <MapPin class="h-5 w-5 text-blue-600" />
          <h3 class="text-lg font-semibold text-gray-900">Venues</h3>
        </div>
        <div class="mb-4 grid grid-cols-3 gap-3">
          <div class="rounded-lg bg-slate-50 px-3 py-2">
            <p class="text-xs text-gray-500">Total</p>
            <p class="text-lg font-semibold">{{ reports?.resourceStats.venues.total ?? 0 }}</p>
          </div>
          <div class="rounded-lg bg-emerald-50 px-3 py-2">
            <p class="text-xs text-gray-500">Available</p>
            <p class="text-lg font-semibold">{{ reports?.resourceStats.venues.available ?? 0 }}</p>
          </div>
          <div class="rounded-lg bg-amber-50 px-3 py-2">
            <p class="text-xs text-gray-500">Unavailable</p>
            <p class="text-lg font-semibold">{{ reports?.resourceStats.venues.unavailable ?? 0 }}</p>
          </div>
        </div>
        <p class="mb-2 text-sm font-medium text-gray-700">Most requested venues</p>
        <ul class="space-y-1 text-sm text-gray-600">
          <li v-for="row in countList(reports?.resourceStats.venues.mostRequested)" :key="row.name">
            {{ row.name }} — {{ row.count }}
          </li>
          <li v-if="!countList(reports?.resourceStats.venues.mostRequested).length">No venue requests yet.</li>
        </ul>
      </div>

      <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div class="mb-4 flex items-center gap-2">
          <Wrench class="h-5 w-5 text-blue-600" />
          <h3 class="text-lg font-semibold text-gray-900">Equipment</h3>
        </div>
        <div class="mb-4 grid grid-cols-3 gap-3">
          <div class="rounded-lg bg-slate-50 px-3 py-2">
            <p class="text-xs text-gray-500">Total</p>
            <p class="text-lg font-semibold">{{ reports?.resourceStats.equipment.total ?? 0 }}</p>
          </div>
          <div class="rounded-lg bg-emerald-50 px-3 py-2">
            <p class="text-xs text-gray-500">Available</p>
            <p class="text-lg font-semibold">{{ reports?.resourceStats.equipment.available ?? 0 }}</p>
          </div>
          <div class="rounded-lg bg-amber-50 px-3 py-2">
            <p class="text-xs text-gray-500">Unavailable</p>
            <p class="text-lg font-semibold">{{ reports?.resourceStats.equipment.unavailable ?? 0 }}</p>
          </div>
        </div>
        <p class="mb-2 text-sm font-medium text-gray-700">Most requested equipment</p>
        <ul class="space-y-1 text-sm text-gray-600">
          <li v-for="row in countList(reports?.resourceStats.equipment.mostRequested)" :key="row.name">
            {{ row.name }} — {{ row.count }}
          </li>
          <li v-if="!countList(reports?.resourceStats.equipment.mostRequested).length">
            No equipment requests yet.
          </li>
        </ul>
      </div>
    </div>

    <div class="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 class="mb-4 text-lg font-semibold text-gray-900">Resource requests by office</h3>
      <p class="mb-4 text-xs text-slate-500">
        Counts unique events assigned to each office (one event with GSO + IT + Sports counts once per office, not as
        three total events).
      </p>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div
          v-for="row in countList(reports?.resourceStats.requestsByOffice)"
          :key="row.name"
          class="rounded-lg border border-gray-100 bg-slate-50 px-4 py-3"
        >
          <p class="text-sm text-gray-600">{{ row.name }}</p>
          <p class="text-xl font-semibold text-gray-900">{{ row.count }}</p>
        </div>
      </div>
    </div>

    <!-- Students by college (preserved) -->
    <div class="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div class="mb-6 flex items-center justify-between gap-3">
        <h3 class="text-lg font-semibold text-gray-900">Students by College</h3>
        <button
          type="button"
          class="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-700"
          @click="exportCollegeStats"
        >
          <Download class="h-4 w-4" />
          Export
        </button>
      </div>
      <div
        v-if="!studentsByCollege.length"
        class="flex min-h-[220px] items-center justify-center text-sm text-gray-500"
      >
        No college data yet.
      </div>
      <div v-else class="flex min-h-[220px] flex-col items-center justify-center gap-8 sm:flex-row">
        <div
          class="h-40 w-40 shrink-0 rounded-full border border-gray-200 shadow-inner"
          :style="{ background: pieGradient }"
          aria-hidden="true"
        />
        <ul class="w-full max-w-xs space-y-2">
          <li v-for="item in pieLegend" :key="item.name" class="flex items-center gap-2 text-sm">
            <span class="inline-block h-3 w-3 shrink-0 rounded-sm" :style="{ backgroundColor: item.color }" />
            <span class="flex-1 text-gray-800">{{ item.name }}</span>
            <span class="text-gray-600">{{ item.pct }}%</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- Detailed report table -->
    <div class="mb-8 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4">
        <div>
          <h3 class="text-lg font-semibold text-gray-900">Detailed Event Report</h3>
          <p class="text-sm text-gray-500">{{ reports?.detailRows.length ?? 0 }} event(s) matching filters</p>
        </div>
        <button
          type="button"
          class="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
          @click="exportDetailReport"
        >
          <Download class="h-4 w-4" />
          Export table
        </button>
      </div>
      <div class="dash-table-wrap">
        <table class="portal-table min-w-0">
          <thead>
            <tr>
              <th>Event</th>
              <th>Organization</th>
              <th>College</th>
              <th>Requester</th>
              <th>Date</th>
              <th>Venue</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading && !(reports?.detailRows.length)">
              <td colspan="7" class="py-8 text-center text-sm text-gray-500">Loading…</td>
            </tr>
            <tr v-else-if="!(reports?.detailRows.length)">
              <td colspan="7" class="py-8 text-center text-sm text-gray-500">
                No events match the current filters.
              </td>
            </tr>
            <tr v-for="row in reports?.detailRows ?? []" :key="row.id">
              <td class="font-medium text-gray-900">{{ row.event }}</td>
              <td>{{ row.organization }}</td>
              <td>{{ row.college }}</td>
              <td>
                <div>{{ row.requester }}</div>
                <div class="text-xs text-slate-500">{{ row.requesterRole }}</div>
              </td>
              <td>{{ row.date }}</td>
              <td>{{ row.venue }}</td>
              <td>{{ row.status }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Export (preserved) -->
    <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 class="mb-4 text-lg font-semibold text-gray-900">Export Reports</h3>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          class="flex items-center justify-center gap-2 rounded-lg border-2 border-gray-300 px-4 py-3 text-gray-700 transition-colors hover:border-blue-500 hover:text-blue-700"
          @click="exportStudentRegistry"
        >
          <Download class="h-5 w-5" />
          Student registry (CSV)
        </button>
        <button
          type="button"
          class="flex items-center justify-center gap-2 rounded-lg border-2 border-gray-300 px-4 py-3 text-gray-700 transition-colors hover:border-blue-500 hover:text-blue-700"
          @click="exportUsersByRole"
        >
          <Download class="h-5 w-5" />
          Users by role (CSV)
        </button>
        <button
          type="button"
          class="flex items-center justify-center gap-2 rounded-lg border-2 border-gray-300 px-4 py-3 text-gray-700 transition-colors hover:border-blue-500 hover:text-blue-700"
          @click="exportCollegeStats"
        >
          <Download class="h-5 w-5" />
          College statistics (CSV)
        </button>
        <button
          type="button"
          class="flex items-center justify-center gap-2 rounded-lg border-2 border-gray-300 px-4 py-3 text-gray-700 transition-colors hover:border-blue-500 hover:text-blue-700"
          @click="exportDetailReport"
        >
          <Download class="h-5 w-5" />
          Event detail report (CSV)
        </button>
      </div>
    </div>
  </div>
</template>
