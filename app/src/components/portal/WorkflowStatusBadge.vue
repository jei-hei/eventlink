<script setup lang="ts">
import { computed } from "vue";
import StatusBadge from "./StatusBadge.vue";
import { displayWorkflowStatus } from "@/composables/displayWorkflowStatus";

const props = defineProps<{ status: string }>();

const mapped = computed(() => {
  const label = displayWorkflowStatus(props.status);
  if (label === "Approved" || props.status.includes("Scheduled")) return { label, tone: "success" as const };
  if (label === "Rejected" || label === "Declined" || label === "Returned") return { label, tone: "danger" as const };
  if (label.includes("Pending")) return { label, tone: "warning" as const };
  return { label, tone: "neutral" as const };
});
</script>

<template>
  <StatusBadge :label="mapped.label" :tone="mapped.tone" />
</template>
