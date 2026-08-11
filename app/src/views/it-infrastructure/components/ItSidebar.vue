<script setup lang="ts">
import { RouterLink, useRoute } from "vue-router";
import { LayoutDashboard, BarChart2, Package, ClipboardList, X, ChevronRight, UserCircle } from "lucide-vue-next";
import PortalSidebarFooter from "@/components/portal/PortalSidebarFooter.vue";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();
const route = useRoute();

const navItems = [
  { label: "Dashboard", to: "/it-infrastructure", name: "it-dashboard", icon: LayoutDashboard },
  { label: "Equipment", to: "/it-infrastructure/equipment", name: "it-equipment", icon: Package },
  { label: "Requests", to: "/it-infrastructure/requests", name: "it-requests", icon: ClipboardList },
  { label: "Analytics", to: "/it-infrastructure/analytics", name: "it-analytics", icon: BarChart2 },
  { label: "Profile", to: "/it-infrastructure/profile", name: "it-profile", icon: UserCircle },
] as const;

function isActive(name: string) {
  return route.name === name;
}
</script>

<template>
  <div class="portal-sidebar-slot">
    <div v-if="open" class="portal-sidebar-backdrop z-40" aria-hidden="true" @click="emit('close')" />
    <aside :class="['portal-sidebar transform', open ? 'translate-x-0' : '-translate-x-full']">
      <div class="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5 sm:py-3.5">
        <div class="flex min-w-0 items-center gap-2.5">
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md ring-1 ring-white/20">
            <span class="text-xs font-bold text-white">IT</span>
          </div>
          <div>
            <div class="text-sm font-bold leading-tight text-white">EventLink</div>
            <div class="text-[10px] font-semibold uppercase tracking-wider text-[#4ADE80]">IT Infrastructure</div>
          </div>
        </div>
        <button type="button" class="rounded-lg p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white" aria-label="Close sidebar" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>
      <nav class="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p class="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">Main Menu</p>
        <RouterLink
          v-for="item in navItems"
          :key="item.label"
          :to="item.to"
          :class="[
            'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
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
      <PortalSidebarFooter portal-label="IT Infrastructure" />
    </aside>
  </div>
</template>
