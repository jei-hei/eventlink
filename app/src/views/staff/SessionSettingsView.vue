<script setup lang="ts">
import { computed } from "vue";
import { ShieldCheck } from "lucide-vue-next";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";

const auth = useAuthStore();
const ui = useUiStore();

const toggleEnabled = computed({
  get: () => auth.stayOnlineEnabled,
  set: (value: boolean) => {
    auth.setStayOnlineEnabled(value);
    ui.pushToast(
      "Session setting updated",
      value
        ? "Stay-online mode is ON. You will sign out after 5 hours of inactivity."
        : "Stay-online mode is OFF. You will sign out after 10 minutes of inactivity.",
      "success",
    );
  },
});

const timeoutLabel = computed(() => {
  if (toggleEnabled.value) return "5 hours of inactivity";
  return "10 minutes of inactivity";
});
</script>

<template>
  <div class="dash-page">
    <div class="dash-card max-w-3xl">
      <div class="border-b border-slate-200 px-4 py-3 sm:px-5">
        <div class="flex items-center gap-2">
          <ShieldCheck :size="18" class="text-emerald-600" />
          <h1 class="text-sm font-bold uppercase tracking-wide text-slate-800">Session Settings</h1>
        </div>
        <p class="mt-1 text-sm text-slate-600">
          Control inactivity auto-logout behavior for this account.
        </p>
      </div>

      <div class="space-y-4 px-4 py-4 sm:px-5">
        <div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm font-semibold text-slate-800">Stay online mode</p>
              <p class="mt-1 text-xs text-slate-600">
                ON keeps your account signed in while active and logs out only after
                <span class="font-semibold">5 hours of inactivity</span>.
              </p>
            </div>
            <label class="relative inline-flex cursor-pointer items-center">
              <input v-model="toggleEnabled" type="checkbox" class="peer sr-only" />
              <div
                class="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-emerald-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all peer-checked:after:translate-x-full"
              />
            </label>
          </div>
        </div>

        <p class="text-xs text-slate-500">
          Current behavior: automatic sign out after <span class="font-semibold">{{ timeoutLabel }}</span>.
        </p>
      </div>
    </div>
  </div>
</template>
