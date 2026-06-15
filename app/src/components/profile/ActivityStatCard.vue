<script setup lang="ts">
import type { ActivityStatIconKey } from "@/types/portalProfile";
import { activityStatIconMap } from "./activityStatIcons";

defineProps<{
  label: string;
  value: number;
  iconKey: ActivityStatIconKey;
}>();

const iconComp = (k: ActivityStatIconKey) => activityStatIconMap[k];
</script>

<template>
  <div
    class="flex min-w-0 flex-col gap-2 rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-sm ring-1 ring-slate-900/[0.02] transition hover:border-emerald-200/80 hover:shadow-md"
  >
    <div class="flex items-center justify-between gap-2">
      <div
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600/90 to-teal-700/90 text-white shadow-sm"
      >
        <component :is="iconComp(iconKey)" class="h-5 w-5" stroke-width="2" />
      </div>
      <p class="text-2xl font-bold tabular-nums text-slate-900">{{ value }}</p>
    </div>
    <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ label }}</p>
  </div>
</template>
