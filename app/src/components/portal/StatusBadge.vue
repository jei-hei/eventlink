<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    tone?: "neutral" | "success" | "warning" | "danger" | "info";
  }>(),
  { tone: "neutral" },
);

const toneClass: Record<"neutral" | "success" | "warning" | "danger" | "info", string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200/80",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200/80",
  warning: "bg-amber-50 text-amber-900 ring-amber-200/80",
  danger: "bg-red-50 text-red-800 ring-red-200/80",
  info: "bg-sky-50 text-sky-900 ring-sky-200/80",
};
</script>

<template>
  <span
    class="inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset"
    :class="toneClass[tone ?? 'neutral']"
  >
    <span class="truncate">{{ label }}</span>
  </span>
</template>
