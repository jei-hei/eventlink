<script setup lang="ts">
import { computed, ref } from "vue";
import ResourceEquipmentManager from "@/components/portal/ResourceEquipmentManager.vue";
import type { ResourceOffice } from "@/types/resourceOffice";
import { resourceOfficeLabel } from "@/types/resourceOffice";

const offices: ResourceOffice[] = ["gso", "it_infrastructure"];
const office = ref<ResourceOffice>("gso");
const title = computed(() => `${resourceOfficeLabel(office.value)} Equipment`);
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="flex shrink-0 gap-2 px-1 pb-3" role="tablist" aria-label="Equipment office">
      <button
        v-for="o in offices"
        :key="o"
        type="button"
        role="tab"
        :aria-selected="office === o"
        :class="[
          'rounded-lg px-4 py-2 text-sm font-semibold transition',
          office === o ? 'bg-emerald-600 text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
        ]"
        @click="office = o"
      >
        {{ resourceOfficeLabel(o) }}
      </button>
    </div>
    <ResourceEquipmentManager :office="office" :title="title" />
  </div>
</template>
