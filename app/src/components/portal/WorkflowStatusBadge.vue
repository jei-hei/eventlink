<script setup lang="ts">
import { computed } from "vue";
import StatusBadge from "./StatusBadge.vue";

const props = defineProps<{ status: string }>();

const mapped = computed(() => {
  const s = props.status;
  if (s === "Approved" || s.includes("Scheduled")) return { label: s, tone: "success" as const };
  if (s === "Rejected" || s === "Declined" || s === "Returned") return { label: s, tone: "danger" as const };
  if (s.includes("Pending")) return { label: s, tone: "warning" as const };
  return { label: s, tone: "neutral" as const };
});
</script>

<template>
  <StatusBadge :label="mapped.label" :tone="mapped.tone" />
</template>
