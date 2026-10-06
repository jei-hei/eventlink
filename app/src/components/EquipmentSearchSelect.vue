<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ChevronDown, Search } from "lucide-vue-next";
import type { EquipmentRow } from "@/services/equipmentDb";

const props = defineProps<{
  options: EquipmentRow[];
  /** Equipment already chosen in other rows of the same form. */
  takenIds?: Set<string>;
}>();

const model = defineModel<string>({ required: true });

const query = ref("");
const open = ref(false);
const activeIndex = ref(0);

const selected = computed(() => props.options.find((o) => o.id === model.value) ?? null);

function isDisabled(eq: EquipmentRow) {
  return eq.quantity_available <= 0 || (!!props.takenIds?.has(eq.id) && eq.id !== model.value);
}

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.options;
  return props.options.filter(
    (o) => o.name.toLowerCase().includes(q) || o.description.toLowerCase().includes(q),
  );
});

watch(filtered, () => {
  activeIndex.value = Math.max(0, filtered.value.findIndex((o) => !isDisabled(o)));
});

function openList() {
  query.value = "";
  open.value = true;
  activeIndex.value = Math.max(0, filtered.value.findIndex((o) => o.id === model.value));
}

function choose(eq: EquipmentRow) {
  if (isDisabled(eq)) return;
  model.value = eq.id;
  open.value = false;
  query.value = "";
}

function move(step: number) {
  const list = filtered.value;
  if (!list.length) return;
  let i = activeIndex.value;
  for (let n = 0; n < list.length; n += 1) {
    i = (i + step + list.length) % list.length;
    if (!isDisabled(list[i]!)) break;
  }
  activeIndex.value = i;
}

function onEnter() {
  const eq = filtered.value[activeIndex.value];
  if (eq) choose(eq);
}
</script>

<template>
  <div class="relative">
    <div class="relative">
      <Search :size="15" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        :value="open ? query : selected?.name ?? ''"
        type="text"
        role="combobox"
        :aria-expanded="open"
        autocomplete="off"
        class="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-8 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
        :placeholder="selected ? selected.name : 'Search equipment…'"
        @focus="openList"
        @input="query = ($event.target as HTMLInputElement).value; open = true"
        @blur="open = false"
        @keydown.down.prevent="open ? move(1) : openList()"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="onEnter"
        @keydown.esc="open = false"
      />
      <ChevronDown :size="15" class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
    </div>
    <ul
      v-if="open"
      role="listbox"
      class="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg"
    >
      <li v-if="!filtered.length" class="px-3 py-2 text-gray-500">No equipment matches "{{ query }}".</li>
      <li
        v-for="(eq, i) in filtered"
        :key="eq.id"
        role="option"
        :aria-selected="eq.id === model"
        :aria-disabled="isDisabled(eq)"
        :class="[
          'flex items-center justify-between gap-2 px-3 py-2',
          isDisabled(eq) ? 'cursor-not-allowed text-gray-400' : 'cursor-pointer text-gray-800',
          i === activeIndex && !isDisabled(eq) ? 'bg-emerald-50' : '',
          eq.id === model ? 'font-semibold' : '',
        ]"
        @mousedown.prevent="choose(eq)"
        @mouseenter="!isDisabled(eq) && (activeIndex = i)"
      >
        <span class="truncate">{{ eq.name }}</span>
        <span class="shrink-0 text-xs" :class="eq.quantity_available <= 0 ? 'text-red-500' : 'text-gray-500'">
          <template v-if="eq.quantity_available <= 0">unavailable</template>
          <template v-else-if="takenIds?.has(eq.id) && eq.id !== model">already added</template>
          <template v-else>{{ eq.quantity_available }} available</template>
        </span>
      </li>
    </ul>
  </div>
</template>
