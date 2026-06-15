<script setup lang="ts">
import { ref } from "vue";
import { RouterLink } from "vue-router";
import { ArrowLeft, GraduationCap, Mail } from "lucide-vue-next";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";

const auth = useAuthStore();
const ui = useUiStore();
const email = ref("");
const sent = ref(false);
const loading = ref(false);

async function submit() {
  if (!email.value.trim()) return;
  loading.value = true;
  try {
    await auth.resetPassword(email.value.trim());
    sent.value = true;
    ui.pushToast("Check your inbox", "If this email exists, reset instructions were sent.", "info");
  } catch (e) {
    ui.pushToast(
      "Could not send reset",
      e instanceof Error ? e.message : "Try again later.",
      "error",
    );
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="portal-root flex min-h-dvh flex-col">
    <div class="flex flex-1 flex-col items-center justify-center px-3 py-10 sm:px-4">
      <div class="mb-6 text-center">
        <div
          class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-lg ring-2 ring-white/30"
        >
          <GraduationCap class="h-7 w-7" />
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900">EventLink</h1>
      </div>

      <div class="auth-glass-card w-full max-w-md">
        <h2 class="text-lg font-semibold text-slate-900">Reset password</h2>
        <p class="mt-1 text-sm text-slate-600">
          Enter the email on your account. We will send a password reset link if it exists.
        </p>

        <form v-if="!sent" class="mt-6 space-y-4" @submit.prevent="submit">
          <div>
            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" for="remail"
              >Email</label
            >
            <div class="relative">
              <Mail class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="remail"
                v-model="email"
                type="email"
                class="portal-input pl-10"
                placeholder="you@university.edu"
                required
              />
            </div>
          </div>
          <button type="submit" class="portal-btn w-full" :disabled="loading">
            {{ loading ? "Sending…" : "Send reset link" }}
          </button>
        </form>

        <div v-else class="mt-6 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900">
          If <span class="font-mono font-semibold">{{ email }}</span> is registered, you will receive next steps
          shortly.
        </div>

        <RouterLink
          to="/login"
          class="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:underline"
        >
          <ArrowLeft class="h-4 w-4" />
          Back to sign in
        </RouterLink>
      </div>
    </div>
  </div>
</template>
