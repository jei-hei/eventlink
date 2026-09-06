<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { Package, RefreshCw } from "lucide-vue-next";
import {
  fetchEquipmentAnalyticsSummary,
  fetchEquipmentOptionsForOffice,
  type EquipmentAnalyticsSummary,
} from "@/services/equipmentAnalyticsDb";
import type { ResourceOffice } from "@/types/resourceOffice";

const props = defineProps<{
  office?: ResourceOffice;
  title?: string;
}>();

const loading = ref(false);
const error = ref<string | null>(null);
const dateFrom = ref("");
const dateTo = ref("");
const equipmentId = ref("");
const equipmentOptions = ref<Array<{ id: string; name: string }>>([]);
const summary = ref<EquipmentAnalyticsSummary>({
  totalAvailableUnits: 0,
  totalUnavailableUnits: 0,
  zeroStockCount: 0,
  activeEquipmentCount: 0,
  requestCountsByStatus: {},
});

const statusEntries = computed(() =>
  Object.entries(summary.value.requestCountsByStatus).sort((a, b) => b[1] - a[1]),
);

async function loadOptions() {
  equipmentOptions.value = await fetchEquipmentOptionsForOffice(props.office);
}

async function loadSummary() {
  loading.value = true;
  error.value = null;
  try {
    summary.value = await fetchEquipmentAnalyticsSummary({
      dateFrom: dateFrom.value || undefined,
      dateTo: dateTo.value || undefined,
      equipmentId: equipmentId.value || undefined,
      office: props.office,
    });
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Could not load equipment analytics.";
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await loadOptions();
  await loadSummary();
});

watch(
  () => props.office,
  async () => {
    equipmentId.value = "";
    await loadOptions();
    await loadSummary();
  },
);
</script>

<template>
  <div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div class="flex items-center gap-2">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <Package :size="16" />
        </div>
        <div>
          <h3 class="text-sm font-bold text-gray-800">{{ title ?? "Equipment analytics" }}</h3>
          <p class="text-xs text-gray-500">Stock levels and request volume</p>
        </div>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        :disabled="loading"
        @click="loadSummary"
      >
        <RefreshCw :size="14" :class="loading ? 'animate-spin' : ''" />
        Refresh
      </button>
    </div>

    <div class="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
      <label class="text-xs font-semibold text-gray-600">
        From
        <input v-model="dateFrom" type="date" class="input-dash mt-1 w-full py-1.5 text-sm" @change="loadSummary" />
      </label>
      <label class="text-xs font-semibold text-gray-600">
        To
        <input v-model="dateTo" type="date" class="input-dash mt-1 w-full py-1.5 text-sm" @change="loadSummary" />
      </label>
      <label class="text-xs font-semibold text-gray-600">
        Equipment
        <select v-model="equipmentId" class="input-dash mt-1 w-full py-1.5 text-sm" @change="loadSummary">
          <option value="">All equipment</option>
          <option v-for="item in equipmentOptions" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </label>
    </div>

    <p v-if="error" class="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      {{ error }}
    </p>

    <div class="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div class="rounded-lg bg-gray-50 px-3 py-2.5">
        <p class="text-[10px] font-bold uppercase tracking-wide text-gray-500">Available units</p>
        <p class="text-xl font-bold text-gray-900">{{ summary.totalAvailableUnits }}</p>
      </div>
      <div class="rounded-lg bg-gray-50 px-3 py-2.5">
        <p class="text-[10px] font-bold uppercase tracking-wide text-gray-500">Unavailable units</p>
        <p class="text-xl font-bold text-gray-900">{{ summary.totalUnavailableUnits }}</p>
      </div>
      <div class="rounded-lg bg-gray-50 px-3 py-2.5">
        <p class="text-[10px] font-bold uppercase tracking-wide text-gray-500">Zero stock items</p>
        <p class="text-xl font-bold text-gray-900">{{ summary.zeroStockCount }}</p>
      </div>
      <div class="rounded-lg bg-gray-50 px-3 py-2.5">
        <p class="text-[10px] font-bold uppercase tracking-wide text-gray-500">Active equipment</p>
        <p class="text-xl font-bold text-gray-900">{{ summary.activeEquipmentCount }}</p>
      </div>
    </div>

    <div>
      <p class="mb-2 text-xs font-bold uppercase tracking-wide text-gray-600">Requests by status</p>
      <div v-if="loading" class="py-4 text-center text-sm text-gray-500">Loading…</div>
      <div v-else-if="!statusEntries.length" class="py-4 text-center text-sm text-gray-500">No equipment requests in range.</div>
      <div v-else class="space-y-1.5">
        <div
          v-for="[status, count] in statusEntries"
          :key="status"
          class="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm"
        >
          <span class="capitalize text-gray-700">{{ status.replace(/_/g, " ") }}</span>
          <span class="font-bold text-gray-900">{{ count }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
