<script setup lang="ts">
import { RouterLink, useRoute } from "vue-router";
import { LayoutDashboard, ClipboardList, BarChart2, X, ChevronRight, UserCircle, Settings } from "lucide-vue-next";
import PortalSidebarFooter from "@/components/portal/PortalSidebarFooter.vue";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const route = useRoute();

const navItems = [
  { label: "Dashboard", to: "/executive-officer", name: "eo-dashboard", icon: LayoutDashboard },
  { label: "Analytics", to: "/executive-officer/analytics", name: "eo-analytics", icon: BarChart2 },
  { label: "Event Monitoring", to: "/executive-officer/events", name: "eo-events", icon: ClipboardList },
  { label: "Settings", to: "/executive-officer/settings", name: "eo-settings", icon: Settings },
  { label: "Profile", to: "/executive-officer/profile", name: "eo-profile", icon: UserCircle },
] as const;

function isActive(name: string) {
  return route.name === name;
}
</script>

<template>
  <div class="portal-sidebar-slot">
    <div
      v-if="open"
      class="portal-sidebar-backdrop z-40"
      aria-hidden="true"
      @click="emit('close')"
    />

    <aside
      :class="[
        'portal-sidebar transform',
        open ? 'translate-x-0' : '-translate-x-full',
      ]"
    >
      <div class="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5 sm:py-3.5">
        <div class="flex min-w-0 items-center gap-2.5">
          <div
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md ring-1 ring-white/20"
          >
            <span class="text-xs font-bold text-white">EO</span>
          </div>
          <div>
            <div class="text-white text-sm font-bold leading-tight">EventLink</div>
            <div class="text-[#4ADE80] text-[10px] font-semibold uppercase tracking-wider">ISU Dashboard</div>
          </div>
        </div>
        <button
          type="button"
          class="text-gray-400 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition"
          aria-label="Close sidebar"
          @click="emit('close')"
        >
          <X :size="18" />
        </button>
      </div>

      <nav class="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <p class="text-gray-500 text-[10px] font-bold uppercase tracking-widest px-3 mb-2">Main Menu</p>
        <RouterLink
          v-for="item in navItems"
          :key="item.label"
          :to="item.to"
          :class="[
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition group relative',
            isActive(item.name)
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md ring-1 ring-white/15'
              : 'text-slate-400 hover:bg-white/10 hover:text-white',
          ]"
          @click="emit('close')"
        >
          <component :is="item.icon" :size="18" class="shrink-0" />
          <span class="flex-1">{{ item.label }}</span>
          <ChevronRight v-if="isActive(item.name)" :size="14" class="shrink-0 opacity-70" />
        </RouterLink>
      </nav>

      <PortalSidebarFooter portal-label="Executive Officer" />
    </aside>
  </div>
</template>
