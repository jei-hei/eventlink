<script setup lang="ts">
withDefaults(
  defineProps<{
    rows?: number;
    columns?: number;
  }>(),
  { rows: 5, columns: 6 },
);
</script>

<template>
  <tr
    v-for="row in rows"
    :key="row"
    class="border-b border-slate-100"
    aria-hidden="true"
  >
    <td
      v-for="col in columns"
      :key="col"
      class="px-3 py-3 sm:px-4"
    >
      <div
        class="h-4 animate-pulse rounded-md bg-slate-200/90"
        :class="col === columns ? 'mx-auto w-20' : col % 2 === 0 ? 'max-w-[10rem]' : 'max-w-[7rem]'"
      />
    </td>
  </tr>
</template>
