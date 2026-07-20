<script setup lang="ts">
withDefaults(defineProps<{ rows?: number }>(), { rows: 5 });
</script>

<template>
  <div class="divide-y divide-gray-200" aria-busy="true" aria-label="Loading list">
    <div v-for="n in rows" :key="n" class="flex items-center justify-between gap-4 px-6 py-4">
      <div class="min-w-0 flex-1 space-y-2">
        <div class="h-4 w-48 max-w-full animate-pulse rounded bg-slate-200" />
        <div class="h-3 w-64 max-w-full animate-pulse rounded bg-slate-200" />
      </div>
      <div class="h-3 w-16 shrink-0 animate-pulse rounded bg-slate-200" />
    </div>
  </div>
</template>
