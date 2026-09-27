<script setup lang="ts">
import { computed } from "vue";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import {
  currentAnalyticsPeriod,
  type AnalyticsPeriod,
} from "@/services/analyticsDb";

const props = defineProps<{
  period: AnalyticsPeriod;
  canNext?: boolean;
}>();

const emit = defineEmits<{
  "update:period": [period: AnalyticsPeriod];
  shift: [delta: number];
}>();

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const now = currentAnalyticsPeriod();
const years = computed(() => {
  const list: number[] = [];
  for (let y = now.year; y >= now.year - 5; y -= 1) list.push(y);
  return list;
});

function onMonth(month: number) {
  emit("update:period", { year: props.period.year, month });
}

function onYear(year: number) {
  emit("update:period", { year, month: props.period.month });
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <button
      type="button"
      class="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50"
      aria-label="Previous month"
      @click="emit('shift', -1)"
    >
      <ChevronLeft :size="16" />
    </button>
    <select
      class="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-700"
      :value="period.month"
      @change="onMonth(Number(($event.target as HTMLSelectElement).value))"
    >
      <option v-for="(label, index) in months" :key="label" :value="index + 1">{{ label }}</option>
    </select>
    <select
      class="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-700"
      :value="period.year"
      @change="onYear(Number(($event.target as HTMLSelectElement).value))"
    >
      <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
    </select>
    <button
      type="button"
      class="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
      aria-label="Next month"
      :disabled="canNext === false"
      @click="emit('shift', 1)"
    >
      <ChevronRight :size="16" />
    </button>
  </div>
</template>
