<script setup lang="ts">
import { computed } from "vue";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import { PAGE_SIZE_OPTIONS, showingLabel } from "@/types/pagination";

const props = withDefaults(
  defineProps<{
    page: number;
    pageSize: number;
    total: number;
    loading?: boolean;
    disabled?: boolean;
    showPageSize?: boolean;
  }>(),
  {
    loading: false,
    disabled: false,
    showPageSize: true,
  },
);

const emit = defineEmits<{
  "update:page": [page: number];
  "update:pageSize": [pageSize: number];
}>();

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / Math.max(1, props.pageSize))));
const canPrev = computed(() => props.page > 1 && !props.loading && !props.disabled);
const canNext = computed(() => props.page < totalPages.value && !props.loading && !props.disabled);
const label = computed(() => showingLabel(props.page, props.pageSize, props.total));

const pageButtons = computed(() => {
  const total = totalPages.value;
  const current = props.page;
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, total, current, current - 1, current + 1, 2, total - 1]);
  return [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
});

function go(p: number) {
  if (p < 1 || p > totalPages.value || p === props.page) return;
  emit("update:page", p);
}

function onPageSize(e: Event) {
  const value = Number((e.target as HTMLSelectElement).value);
  emit("update:pageSize", value);
}
</script>

<template>
  <div
    class="flex flex-col gap-2 border-t border-slate-200/80 bg-slate-50/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
  >
    <p class="text-xs text-slate-600">
      <span v-if="loading">Loading…</span>
      <span v-else>{{ label }}</span>
    </p>

    <div class="flex flex-wrap items-center gap-2">
      <label v-if="showPageSize" class="flex items-center gap-1.5 text-xs text-slate-600">
        Rows
        <select
          class="rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-800"
          :value="pageSize"
          :disabled="loading || disabled"
          @change="onPageSize"
        >
          <option v-for="n in PAGE_SIZE_OPTIONS" :key="n" :value="n">{{ n }}</option>
        </select>
      </label>

      <div class="flex items-center gap-1">
        <button
          type="button"
          class="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 disabled:opacity-40"
          :disabled="!canPrev"
          @click="go(page - 1)"
        >
          <ChevronLeft class="h-3.5 w-3.5" />
          Prev
        </button>

        <template v-for="(p, idx) in pageButtons" :key="p">
          <span
            v-if="idx > 0 && p - pageButtons[idx - 1]! > 1"
            class="px-1 text-xs text-slate-400"
          >…</span>
          <button
            type="button"
            class="inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-semibold"
            :class="
              p === page
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            "
            :disabled="loading || disabled"
            @click="go(p)"
          >
            {{ p }}
          </button>
        </template>

        <button
          type="button"
          class="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 disabled:opacity-40"
          :disabled="!canNext"
          @click="go(page + 1)"
        >
          Next
          <ChevronRight class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>
