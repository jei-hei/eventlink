<script setup lang="ts">
import type { RoleBadgeTone } from "@/types/portalProfile";

const props = defineProps<{
  label: string;
  tone: RoleBadgeTone;
}>();

const toneClass: Record<RoleBadgeTone, string> = {
  green: "bg-emerald-100 text-emerald-900 ring-emerald-200/90",
  teal: "bg-teal-100 text-teal-900 ring-teal-200/90",
  blue: "bg-sky-100 text-sky-900 ring-sky-200/90",
  purple: "bg-violet-100 text-violet-900 ring-violet-200/90",
  orange: "bg-orange-100 text-orange-900 ring-orange-200/90",
  red: "bg-red-100 text-red-900 ring-red-200/90",
  slate: "bg-slate-100 text-slate-800 ring-slate-200/90",
};
</script>

<template>
  <span
    class="inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset"
    :class="toneClass[props.tone]"
  >
    <span class="truncate">{{ props.label }}</span>
  </span>
</template>
