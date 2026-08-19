<script setup lang="ts">
import { RouterLink } from "vue-router";
import EventMonitoringView from "@/components/portal/EventMonitoringView.vue";
</script>

<template>
  <div class="portal-root flex min-h-dvh flex-col bg-slate-50">
    <header class="portal-topbar shrink-0">
      <div class="mx-auto flex w-full max-w-[1400px] items-center gap-3 px-3 py-2 sm:px-4">
        <RouterLink to="/student" class="portal-topbar-btn text-sm font-medium">← Events</RouterLink>
        <span class="text-sm font-semibold text-white">Event Monitoring</span>
      </div>
    </header>
    <main class="mx-auto w-full max-w-[1400px] flex-1 px-3 py-4 sm:px-4">
      <EventMonitoringView />
    </main>
  </div>
</template>
