<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { BarChart2, CalendarDays, CheckCircle2, MapPin, Package, RefreshCw, TrendingUp } from "lucide-vue-next";
import {
  emptyOfficeResourceAnalytics,
  fetchOfficeResourceAnalytics,
  type OfficeResourceAnalytics,
  type UsageBar,
} from "@/services/officeResourceAnalyticsDb";
import type { ResourceOffice } from "@/types/resourceOffice";

const props = defineProps<{
  office: Exclude<ResourceOffice, "ssc">;
  showVenues?: boolean;
  showEquipment?: boolean;
}>();

const loading = ref(false);
const error = ref<string | null>(null);
const data = ref<OfficeResourceAnalytics>(emptyOfficeResourceAnalytics());

const showVenues = computed(() => props.showVenues !== false);
const showEquipment = computed(() => props.showEquipment !== false);

function maxCount(rows: UsageBar[]): number {
  return Math.max(1, ...rows.map((r) => r.count));
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    data.value = await fetchOfficeResourceAnalytics(props.office);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Could not load analytics.";
    data.value = emptyOfficeResourceAnalytics();
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
});

watch(
  () => props.office,
  () => {
    void load();
  },
);

const mostUsedVenue = computed(() => data.value.venueUsage[0] ?? null);
const mostRequestedEquipment = computed(() => data.value.equipmentUsage[0] ?? null);
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-end">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50"
        :disabled="loading"
        @click="load"
      >
        <RefreshCw :size="14" :class="{ 'animate-spin': loading }" />
        Refresh
      </button>
    </div>

    <p v-if="error" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      {{ error }}
    </p>

    <template v-if="showVenues">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="dash-card p-4">
          <div class="mb-2 flex items-center gap-2 text-sm text-gray-500"><MapPin :size="16" /> Total venues</div>
          <p class="text-2xl font-bold text-gray-900">{{ data.venues.total }}</p>
        </div>
        <div class="dash-card p-4">
          <div class="mb-2 flex items-center gap-2 text-sm text-gray-500"><CheckCircle2 :size="16" /> Active venues</div>
          <p class="text-2xl font-bold text-gray-900">{{ data.venues.active }}</p>
        </div>
        <div class="dash-card p-4">
          <div class="mb-2 flex items-center gap-2 text-sm text-gray-500"><CalendarDays :size="16" /> Upcoming events</div>
          <p class="text-2xl font-bold text-gray-900">{{ data.events.upcoming }}</p>
        </div>
        <div class="dash-card p-4">
          <div class="mb-2 flex items-center gap-2 text-sm text-gray-500"><TrendingUp :size="16" /> Completed events</div>
          <p class="text-2xl font-bold text-gray-900">{{ data.events.completed }}</p>
        </div>
      </div>

      <div class="dash-card p-4">
        <h2 class="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-700">
          <BarChart2 :size="16" class="text-emerald-600" /> Venue usage
        </h2>
        <p class="mb-3 text-xs text-gray-400">
          Events using your venues
          <template v-if="mostUsedVenue"> · Most used: {{ mostUsedVenue.name }} ({{ mostUsedVenue.count }})</template>
        </p>
        <div v-if="!data.venueUsage.length" class="py-6 text-center text-xs text-gray-500">No venue assignments yet.</div>
        <ul v-else class="space-y-2">
          <li v-for="row in data.venueUsage" :key="row.name" class="space-y-1">
            <div class="flex items-center justify-between text-xs">
              <span class="truncate font-medium text-gray-700">{{ row.name }}</span>
              <span class="shrink-0 font-semibold text-gray-800">{{ row.count }}</span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-emerald-50">
              <div
                class="h-full rounded-full bg-emerald-500"
                :style="{ width: `${Math.max(6, (row.count / maxCount(data.venueUsage)) * 100)}%` }"
              />
            </div>
          </li>
        </ul>
      </div>
    </template>

    <template v-if="showEquipment">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="dash-card p-4">
          <div class="mb-2 flex items-center gap-2 text-sm text-gray-500"><Package :size="16" /> Total equipment</div>
          <p class="text-2xl font-bold text-gray-900">{{ data.equipment.total }}</p>
        </div>
        <div class="dash-card p-4">
          <div class="mb-2 flex items-center gap-2 text-sm text-gray-500"><CheckCircle2 :size="16" /> Available units</div>
          <p class="text-2xl font-bold text-gray-900">{{ data.equipment.availableUnits }}</p>
        </div>
        <div class="dash-card p-4">
          <div class="mb-2 flex items-center gap-2 text-sm text-gray-500"><CalendarDays :size="16" /> Assigned events</div>
          <p class="text-2xl font-bold text-gray-900">{{ data.events.assigned }}</p>
        </div>
        <div class="dash-card p-4">
          <div class="mb-2 flex items-center gap-2 text-sm text-gray-500"><TrendingUp :size="16" /> Low / zero stock</div>
          <p class="text-2xl font-bold text-gray-900">{{ data.equipment.zeroStock }}</p>
        </div>
      </div>

      <div class="dash-card p-4">
        <h2 class="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-700">
          <BarChart2 :size="16" class="text-emerald-600" /> Equipment usage
        </h2>
        <p class="mb-3 text-xs text-gray-400">
          Requested equipment
          <template v-if="mostRequestedEquipment">
            · Most requested: {{ mostRequestedEquipment.name }} ({{ mostRequestedEquipment.count }})
          </template>
        </p>
        <div v-if="!data.equipmentUsage.length" class="py-6 text-center text-xs text-gray-500">
          No equipment assignments yet.
        </div>
        <ul v-else class="space-y-2">
          <li v-for="row in data.equipmentUsage" :key="row.name" class="space-y-1">
            <div class="flex items-center justify-between text-xs">
              <span class="truncate font-medium text-gray-700">{{ row.name }}</span>
              <span class="shrink-0 font-semibold text-gray-800">{{ row.count }}</span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-emerald-50">
              <div
                class="h-full rounded-full bg-teal-500"
                :style="{ width: `${Math.max(6, (row.count / maxCount(data.equipmentUsage)) * 100)}%` }"
              />
            </div>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
