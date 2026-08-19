<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter, RouterLink, RouterView } from "vue-router";
import {
  Users,
  Building2,
  BarChart3,
  Settings,
  Menu,
  X,
  IdCard,
  UserCircle,
  LogOut,
  LayoutDashboard,
} from "lucide-vue-next";
import NotificationDropdown from "@/components/portal/NotificationDropdown.vue";
import { useAuthStore } from "@/stores/auth";
import { useProfileStore } from "@/stores/profile";
import { useUiStore } from "@/stores/ui";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const profile = useProfileStore();
const ui = useUiStore();
const mobileNav = ref(false);

const adminName = computed(() => auth.displayName ?? "Admin");
const adminEmail = computed(() => auth.email ?? "");

async function onLogout() {
  await auth.signOut();
  profile.clear();
  ui.pushToast("Signed out", "You have been logged out.", "success");
  router.push("/login");
}

const navItems = [
  { to: "/admin", name: "admin-dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/users", name: "admin-users", label: "Users", icon: Users },
  { to: "/admin/students", name: "admin-students", label: "Students", icon: IdCard },
  { to: "/admin/colleges", name: "admin-colleges", label: "Colleges", icon: Building2 },
  { to: "/admin/reports", name: "admin-reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/settings", name: "admin-settings", label: "Settings", icon: Settings },
  { to: "/admin/profile", name: "admin-profile", label: "Profile", icon: UserCircle },
] as const;

const activeName = computed(() => String(route.name ?? ""));

function linkClass(routeName: string) {
  const active = activeName.value === routeName;
  return [
    "flex min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
    active
      ? "bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md ring-1 ring-white/15"
      : "text-slate-300 hover:bg-white/10 hover:text-white",
  ];
}

function iconClass(routeName: string) {
  return activeName.value === routeName ? "h-5 w-5 shrink-0 text-white" : "h-5 w-5 shrink-0 text-slate-400";
}

function closeMobile() {
  mobileNav.value = false;
}
</script>

<template>
  <div class="portal-root portal-app-shell">
    <div class="portal-sidebar-slot">
      <div
        v-if="mobileNav"
        class="portal-sidebar-backdrop z-40"
        aria-hidden="true"
        @click="mobileNav = false"
      />

      <aside
        :class="['admin-sidebar transform', mobileNav ? 'translate-x-0' : '-translate-x-full']"
      >
      <div class="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
        <div class="min-w-0">
          <h1 class="truncate text-base font-bold text-white sm:text-lg">EventLink</h1>
          <p class="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/90">Administration</p>
        </div>
        <button
          type="button"
          class="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
          aria-label="Close menu"
          @click="closeMobile"
        >
          <X :size="20" />
        </button>
      </div>

      <nav class="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        <p class="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Menu</p>
        <RouterLink v-for="item in navItems" :key="item.name" :to="item.to" :class="linkClass(item.name)" @click="closeMobile">
          <component :is="item.icon" :class="iconClass(item.name)" />
          <span class="truncate">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="border-t border-white/10 p-3 sm:p-4">
        <div class="flex items-center gap-3 px-1">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-sm font-bold text-white shadow-md"
          >
            {{ adminName.charAt(0).toUpperCase() }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-white">{{ adminName }}</p>
            <p class="truncate text-xs text-slate-400">{{ adminEmail || "Administrator" }}</p>
          </div>
        </div>
        <button
          type="button"
          class="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
          @click="onLogout"
        >
          <LogOut class="h-4 w-4" />
          Log out
        </button>
      </div>
      </aside>
    </div>

    <div class="portal-shell flex min-h-0 min-w-0 flex-1 flex-col">
      <header class="portal-topbar flex items-center justify-between gap-3">
        <button
          type="button"
          class="portal-topbar-btn shrink-0"
          aria-label="Open menu"
          @click="mobileNav = true"
        >
          <Menu :size="22" />
        </button>
        <span class="min-w-0 truncate text-sm font-semibold">Admin</span>
        <NotificationDropdown />
      </header>

      <main class="portal-main-scroll bg-slate-50/80">
        <div class="mx-auto w-full max-w-[1600px] px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
          <RouterView />
        </div>
      </main>
    </div>
  </div>
</template>
