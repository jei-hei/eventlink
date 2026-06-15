<script setup lang="ts">
/**
 * Wraps content in `portal-table-wrap` + `portal-table` for consistent
 * horizontal scroll and sticky header styling (see `main.css`).
 */
defineProps<{
  /** When true, table still renders; show empty row message in tbody via slot */
  minWidthClass?: string;
}>();
</script>

<template>
  <div class="portal-table-wrap">
    <table class="portal-table" :class="minWidthClass">
      <slot />
    </table>
  </div>
</template>
