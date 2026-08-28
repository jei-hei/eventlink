<script setup lang="ts">
import { computed } from "vue";
import { LogOut } from "lucide-vue-next";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useProfileStore } from "@/stores/profile";
import { useUiStore } from "@/stores/ui";
import { appRoleLabel } from "@/types/appRole";

const props = defineProps<{
  /** Short label under the name, e.g. "OSAS" or "Adviser" */
  portalLabel?: string;
}>();

const router = useRouter();
const auth = useAuthStore();
const profile = useProfileStore();
const ui = useUiStore();

const footerName = computed(() => {
  const fromAuth = auth.displayName?.trim();
  if (fromAuth) return fromAuth;
  const p = profile.displayName?.trim();
  if (p && p !== "Guest") return p;
  return "User";
});

const footerRole = computed(() => {
  const fromAuth = appRoleLabel(auth.appRole);
  if (fromAuth) return fromAuth;
  return props.portalLabel || profile.roleLabel || profile.email || "EventLink";
});

async function onLogout() {
  await auth.signOut();
  profile.clear();
  ui.pushToast("Signed out", "You have been logged out.", "success");
  router.push("/login");
}
</script>

<template>
  <div class="border-t border-white/10 p-3 sm:p-4">
    <div class="flex items-center gap-3 px-1">
      <div
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-sm font-bold text-white shadow-md"
      >
        {{ footerName.charAt(0).toUpperCase() || "?" }}
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-white">{{ footerName }}</p>
        <p class="truncate text-xs text-slate-400">{{ footerRole }}</p>
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
</template>
