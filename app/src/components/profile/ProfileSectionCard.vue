<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <section
    class="dash-card overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-sm ring-1 ring-slate-900/[0.02] sm:p-5"
  >
    <header class="flex flex-col gap-0.5 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 class="text-xs font-bold uppercase tracking-widest text-slate-500">{{ title }}</h2>
      <p v-if="description" class="text-xs text-slate-500 sm:text-right">{{ description }}</p>
    </header>
    <div class="mt-4 min-w-0">
      <slot />
    </div>
  </section>
</template>
