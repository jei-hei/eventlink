<script setup lang="ts">
withDefaults(defineProps<{ count?: number }>(), { count: 4 });
</script>

<template>
  <div
    class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4"
    aria-busy="true"
    aria-label="Loading statistics"
  >
    <div
      v-for="n in count"
      :key="n"
      class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div class="mb-4 h-12 w-12 animate-pulse rounded-lg bg-slate-200" />
      <div class="mb-2 h-3 w-24 animate-pulse rounded bg-slate-200" />
      <div class="h-8 w-16 animate-pulse rounded bg-slate-200" />
    </div>
  </div>
</template>
