<script setup lang="ts">
import { computed } from "vue";
import { SDG_OPTIONS } from "@/constants/sdgs";

const selected = defineModel<number[]>({ default: () => [] });

const selectedSet = computed(() => new Set(selected.value));

function toggle(id: number) {
  const next = new Set(selectedSet.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selected.value = [...next].sort((a, b) => a - b);
}

function isChecked(id: number) {
  return selectedSet.value.has(id);
}
</script>

<template>
  <div>
    <p class="mb-2 text-xs text-gray-600">Select all SDGs that apply to this event (you can choose more than one).</p>
    <div
      class="grid max-h-52 grid-cols-1 gap-2 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 sm:grid-cols-2"
    >
      <label
        v-for="sdg in SDG_OPTIONS"
        :key="sdg.id"
        class="flex cursor-pointer items-start gap-2 rounded-md border border-transparent px-2 py-1.5 transition hover:bg-white"
        :class="isChecked(sdg.id) ? 'border-emerald-200 bg-white shadow-sm' : ''"
      >
        <input
          type="checkbox"
          class="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-[#16A34A] focus:ring-[#16A34A]"
          :checked="isChecked(sdg.id)"
          @change="toggle(sdg.id)"
        />
        <span class="text-sm leading-snug text-gray-800">
          <span class="font-semibold text-emerald-800">SDG {{ sdg.id }}</span>
          — {{ sdg.title }}
        </span>
      </label>
    </div>
    <p v-if="selected.length" class="mt-2 text-xs font-medium text-emerald-700">
      {{ selected.length }} SDG{{ selected.length === 1 ? "" : "s" }} selected
    </p>
  </div>
</template>
