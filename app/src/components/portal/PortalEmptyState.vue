<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center sm:py-12"
  >
    <slot name="icon" />
    <p class="text-sm font-semibold text-slate-800">{{ title }}</p>
    <p v-if="description" class="max-w-md text-xs text-slate-600 sm:text-sm">{{ description }}</p>
    <div v-if="$slots.default" class="mt-2">
      <slot />
    </div>
  </div>
</template>
