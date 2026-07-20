<script setup lang="ts">
withDefaults(defineProps<{ cards?: number }>(), { cards: 3 });
</script>

<template>
  <div class="space-y-4" aria-busy="true" aria-label="Loading posts">
    <article
      v-for="n in cards"
      :key="n"
      class="overflow-hidden rounded-lg border border-gray-200 bg-white"
    >
      <div class="flex items-center gap-3 p-4 pb-2">
        <div class="h-11 w-11 shrink-0 animate-pulse rounded-full bg-slate-200" />
        <div class="min-w-0 flex-1 space-y-2">
          <div class="h-4 w-32 animate-pulse rounded bg-slate-200" />
          <div class="h-3 w-24 animate-pulse rounded bg-slate-200" />
        </div>
      </div>
      <div class="space-y-2 px-4 pb-3">
        <div class="h-4 w-full animate-pulse rounded bg-slate-200" />
        <div class="h-4 w-4/5 max-w-md animate-pulse rounded bg-slate-200" />
      </div>
      <div class="h-48 w-full animate-pulse bg-slate-100" />
      <div class="space-y-2 border-t border-gray-100 bg-gray-50/80 px-4 py-3">
        <div class="h-4 w-40 animate-pulse rounded bg-slate-200" />
        <div class="h-3 w-56 animate-pulse rounded bg-slate-200" />
      </div>
    </article>
  </div>
</template>
