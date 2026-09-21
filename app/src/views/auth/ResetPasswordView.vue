<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { Eye, EyeOff, GraduationCap, Lock } from "lucide-vue-next";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import { toUserFacingError } from "@/utils/userFacingError";

const auth = useAuthStore();
const ui = useUiStore();
const router = useRouter();
const password = ref("");
const confirmation = ref("");
const showPassword = ref(false);
const checkingSession = ref(true);
const submitting = ref(false);
const sessionValid = ref(false);
const error = ref("");

async function verifyRecoverySession() {
  const { data, error: sessionError } = await getSupabase().auth.getSession();
  const hasSession = !sessionError && !!data.session;
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const fromAuthLink = Boolean(
    query.get("code") ||
      query.get("token_hash") ||
      hash.get("access_token") ||
      query.get("type") ||
      hash.get("type"),
  );
  sessionValid.value = hasSession && (auth.passwordRecoveryPending || fromAuthLink);
  if (!sessionValid.value) {
    error.value = "This password reset link is invalid or has expired. Request a new link.";
  } else {
    error.value = "";
  }
}

onMounted(async () => {
  if (!isSupabaseConfigured) {
    error.value = "Password recovery is currently unavailable. Please contact an administrator.";
    checkingSession.value = false;
    return;
  }
  try {
    await auth.whenReady();
    for (let i = 0; i < 8; i++) {
      await verifyRecoverySession();
      if (sessionValid.value) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  } catch (e) {
    error.value = toUserFacingError(e, "Could not verify this password reset link.");
  } finally {
    checkingSession.value = false;
  }
});

watch(
  () => auth.passwordRecoveryPending,
  (pending) => {
    if (pending && isSupabaseConfigured) void verifyRecoverySession();
    else if (!pending) sessionValid.value = false;
  },
);

async function submit() {
  error.value = "";
  if (password.value.length < 8) {
    error.value = "Use at least 8 characters for your new password.";
    return;
  }
  if (password.value !== confirmation.value) {
    error.value = "The passwords do not match.";
    return;
  }

  submitting.value = true;
  try {
    await auth.updatePassword(password.value);
    await auth.signOut();
    ui.pushToast("Password updated", "Sign in with your new password.", "success");
    await router.replace({ name: "login" });
  } catch (e) {
    error.value = toUserFacingError(e, "Could not update your password. Request a new reset link.");
  } finally {
    submitting.value = false;
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
        <h2 class="text-lg font-semibold text-slate-900">Choose a new password</h2>
        <p class="mt-1 text-sm text-slate-600">Enter a new password for your account.</p>

        <p v-if="checkingSession" class="mt-6 text-sm text-slate-600">Verifying reset link…</p>

        <form v-else-if="sessionValid" class="mt-6 space-y-4" @submit.prevent="submit">
          <div>
            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" for="new-password">
              New password
            </label>
            <div class="relative">
              <Lock class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="new-password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
                class="portal-input pl-10 pr-11"
                required
              />
              <button
                type="button"
                class="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                @click="showPassword = !showPassword"
              >
                <EyeOff v-if="showPassword" class="h-4 w-4" />
                <Eye v-else class="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" for="confirm-password">
              Confirm password
            </label>
            <input
              id="confirm-password"
              v-model="confirmation"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
              class="portal-input"
              required
            />
          </div>

          <p v-if="error" class="text-sm font-medium text-red-700">{{ error }}</p>
          <button type="submit" class="portal-btn w-full" :disabled="submitting">
            {{ submitting ? "Updating…" : "Update password" }}
          </button>
        </form>

        <div v-else class="mt-6">
          <p class="text-sm font-medium text-red-700">{{ error }}</p>
          <RouterLink to="/forgot-password" class="mt-4 inline-block text-sm font-semibold text-emerald-800 hover:underline">
            Request a new reset link
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>
