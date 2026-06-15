<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useProfileStore } from "@/stores/profile";
import { roleToBadgeTone } from "@/config/portalProfileDefaults";
import RoleBadge from "./RoleBadge.vue";

withDefaults(
  defineProps<{
    /** Tighter header (student-officer / SSC in portal) — matches standalone student profile feel. */
    compact?: boolean;
  }>(),
  { compact: false },
);

const profile = useProfileStore();
const {
  displayName,
  roleLabel,
  roleDescription,
  studentOrEmployeeId,
  memberSince,
  lastLogin,
  isOnline,
  avatarDataUrl,
  portalRole,
} = storeToRefs(profile);

const initials = computed(() => {
  const parts = displayName.value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
});

const fmt = (iso: string) => {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const fmtDateTime = (iso: string) => {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const badgeTone = computed(() => roleToBadgeTone(portalRole.value));
</script>

<template>
  <!-- Compact: same info density as student standalone profile — short strip, not a tall hero card. -->
  <header
    v-if="compact"
    class="dash-card flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white/95 p-3 shadow-sm ring-1 ring-slate-900/[0.02] sm:gap-4 sm:p-4"
  >
    <div class="relative shrink-0">
      <div
        class="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-gradient-to-br from-emerald-600 to-teal-700 text-sm font-bold text-white shadow-md ring-1 ring-emerald-900/10 sm:h-14 sm:w-16 sm:text-base"
      >
        <img v-if="avatarDataUrl" :src="avatarDataUrl" alt="" class="h-full w-full object-cover" />
        <span v-else>{{ initials }}</span>
      </div>
      <span
        class="absolute bottom-0 right-0 flex h-3 w-3 rounded-full border-2 border-white shadow-sm sm:h-3.5 sm:w-3.5"
        :class="isOnline ? 'bg-emerald-500' : 'bg-slate-400'"
        :title="isOnline ? 'Active' : 'Away'"
      />
    </div>
    <div class="min-w-0 flex-1">
      <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <h1 class="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">{{ displayName }}</h1>
        <RoleBadge :label="roleLabel" :tone="badgeTone" class="shrink-0" />
      </div>
      <p class="mt-0.5 line-clamp-1 text-xs text-slate-600 sm:text-sm">{{ roleDescription }}</p>
      <p class="mt-1 truncate font-mono text-xs font-semibold text-slate-800 sm:text-sm">
        {{ portalRole === "admin" || portalRole === "adviser" || portalRole === "dean" || portalRole === "osas" || portalRole === "eo" || portalRole === "gso" ? "Employee ID" : "Student ID" }}:
        {{ studentOrEmployeeId }}
      </p>
      <div class="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 sm:text-xs">
        <span class="inline-flex shrink-0 items-center gap-1 font-medium" :class="isOnline ? 'text-emerald-800' : 'text-slate-500'">
          <span class="h-1.5 w-1.5 rounded-full" :class="isOnline ? 'bg-emerald-500' : 'bg-slate-400'" />
          {{ isOnline ? "Active" : "Away" }}
        </span>
        <span class="hidden text-slate-300 sm:inline">·</span>
        <span class="truncate">Since {{ fmt(memberSince) }}</span>
        <span class="hidden text-slate-300 sm:inline">·</span>
        <span class="truncate">Last {{ fmtDateTime(lastLogin) }}</span>
      </div>
    </div>
  </header>

  <header
    v-else
    class="dash-card relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-emerald-50/30 to-white p-4 shadow-sm ring-1 ring-slate-900/[0.02] sm:p-6"
  >
    <div
      class="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-400/10 blur-2xl"
      aria-hidden="true"
    />
    <div class="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
      <div class="flex shrink-0 justify-center sm:justify-start">
        <div class="relative">
          <div
            class="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-gradient-to-br from-emerald-600 to-teal-700 text-2xl font-bold text-white shadow-lg ring-2 ring-emerald-900/10 sm:h-28 sm:w-28 sm:text-3xl"
          >
            <img v-if="avatarDataUrl" :src="avatarDataUrl" alt="" class="h-full w-full object-cover" />
            <span v-else>{{ initials }}</span>
          </div>
          <span
            class="absolute bottom-1 right-1 flex h-4 w-4 rounded-full border-2 border-white shadow-sm"
            :class="isOnline ? 'bg-emerald-500' : 'bg-slate-400'"
            :title="isOnline ? 'Active' : 'Away'"
          />
        </div>
      </div>

      <div class="min-w-0 flex-1 text-center sm:text-left">
        <div class="flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <h1 class="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{{ displayName }}</h1>
          <RoleBadge :label="roleLabel" :tone="badgeTone" />
        </div>
        <p class="mt-1 text-sm text-slate-600 sm:text-base">{{ roleDescription }}</p>
        <p class="mt-3 font-mono text-sm font-semibold text-slate-800">
          {{ portalRole === "admin" || portalRole === "adviser" || portalRole === "dean" || portalRole === "osas" || portalRole === "eo" || portalRole === "gso" ? "Employee ID" : "Student ID" }}:
          {{ studentOrEmployeeId }}
        </p>
        <div class="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-600 sm:justify-start sm:text-sm">
          <span class="inline-flex items-center gap-1.5 font-medium" :class="isOnline ? 'text-emerald-800' : 'text-slate-500'">
            <span class="h-2 w-2 rounded-full" :class="isOnline ? 'bg-emerald-500' : 'bg-slate-400'" />
            {{ isOnline ? "Active" : "Away" }}
          </span>
          <span>Member since {{ fmt(memberSince) }}</span>
          <span class="hidden sm:inline">·</span>
          <span>Last login: {{ fmtDateTime(lastLogin) }}</span>
        </div>
      </div>
    </div>
  </header>
</template>
