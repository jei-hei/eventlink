<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Clock } from "lucide-vue-next";
import OfficeResourceAnalyticsPanel from "@/components/portal/OfficeResourceAnalyticsPanel.vue";
import ViewAllDashboardButton from "@/components/portal/ViewAllDashboardButton.vue";
import { countPendingForRole } from "@/services/eventRequestsDb";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const pendingCount = ref(0);
const pendingError = ref<string | null>(null);

async function loadPending() {
  try {
    pendingCount.value = await countPendingForRole("it_infrastructure", auth.userId ?? "");
  } catch (e) {
    pendingError.value = e instanceof Error ? e.message : "Could not load pending count.";
  }
}

onMounted(() => void loadPending());
</script>

<template>
  <div class="dash-analytics space-y-4">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p class="text-sm text-gray-500">IT Infrastructure · Equipment analytics</p>
      </div>
      <ViewAllDashboardButton to="/it-infrastructure" />
    </div>

    <p v-if="pendingError" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      {{ pendingError }}
    </p>

    <div class="dash-card p-4 sm:max-w-xs">
      <div class="mb-2 flex items-center gap-2 text-sm text-gray-500"><Clock :size="16" /> Pending review</div>
      <p class="text-2xl font-bold text-gray-900">{{ pendingCount }}</p>
    </div>

    <OfficeResourceAnalyticsPanel office="it_infrastructure" :show-venues="false" :show-equipment="true" />
  </div>
</template>
