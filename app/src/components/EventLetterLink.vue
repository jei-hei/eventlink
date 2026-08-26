<script setup lang="ts">
import ProposalPdfButton from "@/components/ProposalPdfButton.vue";

withDefaults(
  defineProps<{
    letterPath?: string | null;
    label?: string;
    current?: boolean;
  }>(),
  { label: "Proposal document", current: false },
);
</script>

<template>
  <ProposalPdfButton :letter-path="letterPath" :label="label" :current="current" />
</template>
