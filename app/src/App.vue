<script setup lang="ts">
import { onMounted } from "vue";
import { RouterView } from "vue-router";
import PortalToastHost from "@/components/portal/PortalToastHost.vue";
import { useStudentRegistryStore } from "@/stores/studentRegistry";

onMounted(() => {
  const registry = useStudentRegistryStore();
  if (!registry.useSupabase) {
    registry.seedDemo();
  }
});
</script>

<template>
  <RouterView />
  <PortalToastHost />
</template>

<style scoped></style>
