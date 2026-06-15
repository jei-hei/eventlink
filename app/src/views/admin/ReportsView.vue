<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Download, TrendingUp, Users, GraduationCap } from "lucide-vue-next";
import { useStudentRegistryStore } from "@/stores/studentRegistry";
import { useUiStore } from "@/stores/ui";
import { downloadCsv } from "@/utils/downloadCsv";
import { normalizeStudentId } from "@/types/studentRegistry";
import { fetchAdminPortalUsers } from "@/services/adminUsersDb";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

const registry = useStudentRegistryStore();
const ui = useUiStore();

onMounted(() => {
  if (registry.useSupabase) {
    registry.fetchAll().catch(() => {
      /* optional load */
    });
  }
  void loadReportData();
});

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

const loading = ref(false);
const loadError = ref<string | null>(null);

const usersByRole = ref<{ role: string; count: number }[]>([]);
const studentsByCollege = ref<{ name: string; value: number }[]>([]);
const statsRaw = ref({
  reportsGenerated: 0,
  activeUsersThisMonth: 0,
  studentParticipationRate: 0,
});

async function loadReportData() {
  if (!isSupabaseConfigured) return;
  loading.value = true;
  loadError.value = null;
  try {
    const users = await fetchAdminPortalUsers();
    const roleMap = new Map<string, number>();
    users.forEach((u) => {
      const key = u.app_role.replace(/_/g, " ");
      roleMap.set(key, (roleMap.get(key) ?? 0) + 1);
    });
    usersByRole.value = Array.from(roleMap.entries())
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count);

    const collegeMap = new Map<string, number>();
    registry.students
      .filter((s) => !s.archived)
      .forEach((s) => {
        const name = s.course?.trim() || "Unassigned";
        collegeMap.set(name, (collegeMap.get(name) ?? 0) + 1);
      });
    studentsByCollege.value = Array.from(collegeMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const supabase = getSupabase();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [{ count: activeThisMonth }, { count: requestsCount }] = await Promise.all([
      supabase
        .from("event_requests")
        .select("*", { head: true, count: "exact" })
        .gte("created_at", monthStart.toISOString()),
      supabase.from("event_requests").select("*", { head: true, count: "exact" }),
    ]);

    const activeStudents = registry.students.filter((s) => !s.archived).length;
    const distinctRequesters = new Set(users.filter((u) => u.app_role === "student").map((u) => u.user_id)).size;
    statsRaw.value = {
      reportsGenerated: requestsCount ?? 0,
      activeUsersThisMonth: activeThisMonth ?? 0,
      studentParticipationRate: activeStudents ? Math.round((distinctRequesters / activeStudents) * 100) : 0,
    };
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : "Could not load reports.";
  } finally {
    loading.value = false;
  }
}

function exportUsersByRole() {
  if (!usersByRole.value.length) {
    ui.pushToast("No data", "No users to export yet.", "warning");
    return;
  }
  downloadCsv("users-by-role.csv", [
    ["Role", "Count"],
    ...usersByRole.value.map((r) => [r.role, String(r.count)]),
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

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"];

const stats = computed(() => [
  {
    label: "Total Requests Logged",
    value: String(statsRaw.value.reportsGenerated),
    icon: TrendingUp,
    change: "Live",
  },
  {
    label: "Requests This Month",
    value: String(statsRaw.value.activeUsersThisMonth),
    icon: Users,
    change: "Live",
  },
  {
    label: "Student Participation Rate",
    value: `${statsRaw.value.studentParticipationRate}%`,
    icon: GraduationCap,
    change: "Approx",
  },
]);

const maxRoleCount = computed(() => Math.max(...usersByRole.value.map((r) => r.count), 1));

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
    const color = COLORS[i % COLORS.length]!;
    parts.push(`${color} ${start}deg ${end}deg`);
  });
  return `conic-gradient(${parts.join(", ")})`;
});
</script>

<template>
  <div class="p-8">
    <div class="mb-8">
      <h1 class="text-3xl font-semibold text-gray-900 mb-2">Reports & Analytics</h1>
      <p class="text-gray-600">View system statistics and generate reports.</p>
    </div>
    <p v-if="loadError" class="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      {{ loadError }}
    </p>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
      >
        <div class="flex items-center justify-between mb-4">
          <component :is="stat.icon" class="w-8 h-8 text-blue-600" />
          <span class="text-sm text-green-600">{{ stat.change }}</span>
        </div>
        <p class="text-gray-600 text-sm mb-1">{{ stat.label }}</p>
        <p class="text-3xl font-semibold text-gray-900">{{ stat.value }}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="flex items-center justify-between mb-6 gap-3">
          <h3 class="font-semibold text-lg text-gray-900">Users by Role</h3>
          <button
            type="button"
            class="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shrink-0"
            @click="exportUsersByRole"
          >
            <Download class="w-4 h-4" />
            Export
          </button>
        </div>
        <div v-if="loading" class="min-h-[300px] flex items-center justify-center text-sm text-gray-500">Loading…</div>
        <div v-else-if="!usersByRole.length" class="min-h-[300px] flex items-center justify-center text-sm text-gray-500">
          No role data yet.
        </div>
        <div v-else class="space-y-4 min-h-[300px] flex flex-col justify-center">
          <div v-for="row in usersByRole" :key="row.role" class="space-y-1">
            <div class="flex justify-between text-sm">
              <span class="text-gray-700 font-medium truncate pr-2">{{ row.role }}</span>
              <span class="text-gray-600 shrink-0">{{ row.count }}</span>
            </div>
            <div class="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                class="h-full bg-blue-500 rounded-full transition-all"
                :style="{ width: `${(row.count / maxRoleCount) * 100}%` }"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="flex items-center justify-between mb-6 gap-3">
          <h3 class="font-semibold text-lg text-gray-900">Students by College</h3>
          <button
            type="button"
            class="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shrink-0"
            @click="exportCollegeStats"
          >
            <Download class="w-4 h-4" />
            Export
          </button>
        </div>
        <div v-if="loading" class="min-h-[300px] flex items-center justify-center text-sm text-gray-500">Loading…</div>
        <div
          v-else-if="!studentsByCollege.length"
          class="min-h-[300px] flex items-center justify-center text-sm text-gray-500"
        >
          No college data yet.
        </div>
        <div v-else class="flex flex-col sm:flex-row items-center gap-8 min-h-[300px] justify-center">
          <div
            class="w-40 h-40 rounded-full shrink-0 border border-gray-200 shadow-inner"
            :style="{ background: pieGradient }"
            aria-hidden="true"
          />
          <ul class="space-y-2 w-full max-w-xs">
            <li v-for="item in pieLegend" :key="item.name" class="flex items-center gap-2 text-sm">
              <span
                class="inline-block w-3 h-3 rounded-sm shrink-0"
                :style="{ backgroundColor: item.color }"
              />
              <span class="text-gray-800 flex-1">{{ item.name }}</span>
              <span class="text-gray-600">{{ item.pct }}%</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 class="font-semibold text-lg text-gray-900 mb-4">Export Reports</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          class="flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-blue-500 hover:text-blue-700 transition-colors"
          @click="exportStudentRegistry"
        >
          <Download class="w-5 h-5" />
          Student registry (CSV)
        </button>
        <button
          type="button"
          class="flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-blue-500 hover:text-blue-700 transition-colors"
          @click="exportUsersByRole"
        >
          <Download class="w-5 h-5" />
          Users by role (CSV)
        </button>
        <button
          type="button"
          class="flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-blue-500 hover:text-blue-700 transition-colors"
          @click="exportCollegeStats"
        >
          <Download class="w-5 h-5" />
          College statistics (CSV)
        </button>
      </div>
    </div>
  </div>
</template>
