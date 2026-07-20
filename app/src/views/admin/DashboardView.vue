<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Users, UserCheck, Clock3, Building2 } from "lucide-vue-next";
import { fetchAdminRecentActivity, fetchAdminStatsSnapshot, type AdminActivityItem } from "@/services/adminDashboardDb";
import PortalListSkeleton from "@/components/portal/PortalListSkeleton.vue";
import PortalStatSkeleton from "@/components/portal/PortalStatSkeleton.vue";

const loading = ref(false);
const loadError = ref<string | null>(null);
const recentActivity = ref<AdminActivityItem[]>([]);
const statsRaw = ref({
  totalUsers: 0,
  studentsRegistered: 0,
  pendingWorkflowItems: 0,
  activeOrganizations: 0,
});

const stats = computed(() => [
  { label: "Total Users", value: String(statsRaw.value.totalUsers), icon: Users, color: "bg-blue-500" },
  { label: "Students Registered", value: String(statsRaw.value.studentsRegistered), icon: UserCheck, color: "bg-green-500" },
  { label: "Pending Workflow", value: String(statsRaw.value.pendingWorkflowItems), icon: Clock3, color: "bg-yellow-500" },
  { label: "Active Organizations", value: String(statsRaw.value.activeOrganizations), icon: Building2, color: "bg-purple-500" },
]);

async function loadDashboard() {
  loading.value = true;
  loadError.value = null;
  try {
    const [snapshot, activity] = await Promise.all([
      fetchAdminStatsSnapshot(),
      fetchAdminRecentActivity(8),
    ]);
    statsRaw.value = snapshot;
    recentActivity.value = activity;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : "Could not load dashboard.";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadDashboard();
});
</script>

<template>
  <div class="p-8">
    <div class="mb-8">
      <h1 class="text-3xl font-semibold text-gray-900 mb-2">Dashboard</h1>
      <p class="text-gray-600">Live overview of users, registry, and workflow activity.</p>
    </div>

    <p v-if="loadError" class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      {{ loadError }}
    </p>

    <PortalStatSkeleton v-if="loading" class="mb-8" />
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
      >
        <div class="flex items-center justify-between mb-4">
          <div :class="[stat.color, 'w-12 h-12 rounded-lg flex items-center justify-center']">
            <component :is="stat.icon" class="w-6 h-6 text-white" />
          </div>
        </div>
        <p class="text-gray-600 text-sm mb-1">{{ stat.label }}</p>
        <p class="text-3xl font-semibold text-gray-900">{{ stat.value }}</p>
      </div>
    </div>

    <div class="bg-white rounded-lg shadow-sm border border-gray-200">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900">Recent Activity</h2>
      </div>
      <PortalListSkeleton v-if="loading" :rows="6" />
      <div v-else-if="!recentActivity.length" class="px-6 py-8 text-sm text-gray-500">No recent activity yet.</div>
      <div v-else class="divide-y divide-gray-200">
        <div
          v-for="(activity, index) in recentActivity"
          :key="index"
          class="px-6 py-4 hover:bg-gray-50 transition-colors"
        >
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="font-medium text-gray-900">{{ activity.action }}</p>
              <p class="text-sm text-gray-600">{{ activity.user }} - {{ activity.role }}</p>
            </div>
            <span class="text-sm text-gray-500 shrink-0">{{ activity.time }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
