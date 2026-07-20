<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import { Eye, EyeOff, GraduationCap, Lock, Mail, ShieldCheck } from "lucide-vue-next";
import { formatAuthError, useAuthStore } from "@/stores/auth";
import { useProfileStore } from "@/stores/profile";
import { useUiStore } from "@/stores/ui";
import { useNotificationsStore } from "@/stores/notifications";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const profile = useProfileStore();
const ui = useUiStore();
const notifications = useNotificationsStore();

const email = ref("admin@university.edu");
const password = ref("");
const showPassword = ref(false);
const loading = ref(false);
const error = ref("");
const showResendConfirm = ref(false);
const resendLoading = ref(false);
const otpRequired = ref(false);
const otpCode = ref("");
const otpLoading = ref(false);
const otpResendLoading = ref(false);
const otpEmail = ref("");
const failedPasswordAttempts = ref(0);
const lockedUntilMs = ref(0);
const nowMs = ref(Date.now());
let clockTimer: ReturnType<typeof setInterval> | null = null;
const TEST_EMAIL_DOMAINS = new Set([
  "eventlink.local",
  "university.edu",
  "example.com",
  "example.org",
  "test.local",
  "localhost",
]);
const MAX_FAILED_PASSWORD_ATTEMPTS = 3;
const LOCKOUT_MS = 60 * 1000;
const LOCKOUT_KEY_PREFIX = "eventlink:login-lockout:";

const lockRemainingSeconds = computed(() =>
  Math.max(0, Math.ceil((lockedUntilMs.value - nowMs.value) / 1000)),
);
const isPasswordLocked = computed(() => lockRemainingSeconds.value > 0);

watch([email, password], () => {
  error.value = "";
  showResendConfirm.value = false;
});

watch(
  email,
  (mail) => {
    loadLockoutState(mail);
  },
  { immediate: true },
);

onMounted(() => {
  clockTimer = setInterval(() => {
    nowMs.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (clockTimer) {
    clearInterval(clockTimer);
    clockTimer = null;
  }
});

function lockoutKey(mail: string): string {
  return `${LOCKOUT_KEY_PREFIX}${mail.trim().toLowerCase()}`;
}

function loadLockoutState(mail: string) {
  failedPasswordAttempts.value = 0;
  lockedUntilMs.value = 0;
  if (typeof window === "undefined") return;
  const key = lockoutKey(mail);
  const raw = window.localStorage.getItem(key);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as { failedAttempts?: number; lockedUntilMs?: number };
    failedPasswordAttempts.value = Math.max(0, Number(parsed.failedAttempts ?? 0));
    lockedUntilMs.value = Math.max(0, Number(parsed.lockedUntilMs ?? 0));
  } catch {
    window.localStorage.removeItem(key);
  }
}

function persistLockoutState(mail: string) {
  if (typeof window === "undefined") return;
  const key = lockoutKey(mail);
  if (failedPasswordAttempts.value <= 0 && lockedUntilMs.value <= 0) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(
    key,
    JSON.stringify({
      failedAttempts: failedPasswordAttempts.value,
      lockedUntilMs: lockedUntilMs.value,
    }),
  );
}

function clearLockoutState(mail: string) {
  failedPasswordAttempts.value = 0;
  lockedUntilMs.value = 0;
  persistLockoutState(mail);
}

function registerFailedPasswordAttempt(mail: string) {
  const nextAttempts = failedPasswordAttempts.value + 1;
  if (nextAttempts >= MAX_FAILED_PASSWORD_ATTEMPTS) {
    failedPasswordAttempts.value = 0;
    lockedUntilMs.value = Date.now() + LOCKOUT_MS;
  } else {
    failedPasswordAttempts.value = nextAttempts;
  }
  persistLockoutState(mail);
}

async function resendConfirmation() {
  if (!email.value.trim()) return;
  resendLoading.value = true;
  try {
    await auth.resendSignupConfirmation(email.value.trim());
    ui.pushToast("Email sent", "Check your inbox for the confirmation link.", "success");
  } catch (e) {
    ui.pushToast("Could not resend", formatAuthError(e), "error");
  } finally {
    resendLoading.value = false;
  }
}

async function completeLogin() {
  const name = auth.displayName ?? "User";
  profile.setFromAuth(name, auth.email ?? email.value.trim(), auth.appRole ?? "student");
  notifications.push({
    title: "Signed in",
    body: `Hello, ${name}. Workflow and event alerts will appear here.`,
    category: "system",
  });
  ui.pushToast("Signed in", "Welcome back to EventLink.", "success");
  const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "";
  await router.push(redirect || auth.homePath);
}

function isTestEmailAddress(mail: string): boolean {
  const domain = mail.trim().toLowerCase().split("@")[1] ?? "";
  return TEST_EMAIL_DOMAINS.has(domain);
}

async function onSubmit() {
  error.value = "";
  if (!email.value.trim() || !password.value) {
    error.value = "Enter your email and password.";
    return;
  }
  if (isPasswordLocked.value) {
    error.value = `Too many wrong attempts. Try again in ${lockRemainingSeconds.value}s.`;
    return;
  }
  loading.value = true;
  try {
    await auth.signIn(email.value.trim(), password.value, { provisional: true });
    clearLockoutState(email.value);
    const requiresEmailOtp =
      !auth.useMock &&
      auth.appRole !== "student" &&
      !isTestEmailAddress(email.value);
    if (requiresEmailOtp) {
      try {
        await auth.sendEmailOtp(email.value.trim());
        otpRequired.value = true;
        otpEmail.value = email.value.trim();
        otpCode.value = "";
        ui.pushToast("OTP sent", `Enter the code sent to ${otpEmail.value}.`, "info");
      } catch (otpErr) {
        const otpMsg = formatAuthError(otpErr);
        if (otpMsg.toLowerCase().includes("rate")) {
          error.value = "Email rate limit reached. Please wait a few minutes, then try again.";
        } else {
          error.value = otpMsg;
        }
      } finally {
        // Never keep a provisional password session active for OTP-required users.
        try {
          await auth.signOut();
        } catch {
          // Ignore sign-out errors here; user must still verify OTP before access.
        }
      }
      return;
    }
    if (!auth.useMock && auth.appRole !== "student" && isTestEmailAddress(email.value)) {
      ui.pushToast(
        "OTP skipped for test account",
        "This account uses a test email domain. Add a real email to enforce OTP.",
        "warning",
      );
    }
    await auth.activateCurrentSessionSecurity(true);
    await completeLogin();
  } catch (e) {
    const msg = formatAuthError(e);
    const lower = msg.toLowerCase();
    if (lower.includes("invalid email or password") || lower.includes("invalid login credentials")) {
      registerFailedPasswordAttempt(email.value);
      if (isPasswordLocked.value) {
        error.value = `Too many wrong attempts. Try again in ${lockRemainingSeconds.value}s.`;
      } else {
        const left = Math.max(0, MAX_FAILED_PASSWORD_ATTEMPTS - failedPasswordAttempts.value);
        error.value = `${msg} ${left > 0 ? `(${left} attempt${left > 1 ? "s" : ""} left)` : ""}`.trim();
      }
    } else {
      error.value = msg;
    }
    showResendConfirm.value = msg.toLowerCase().includes("not confirmed");
  } finally {
    loading.value = false;
  }
}

async function verifyOtpAndSignIn() {
  error.value = "";
  if (!otpCode.value.trim()) {
    error.value = "Enter the OTP code from your email.";
    return;
  }
  otpLoading.value = true;
  try {
    await auth.verifyEmailOtp(otpEmail.value || email.value.trim(), otpCode.value.trim());
    otpRequired.value = false;
    await completeLogin();
  } catch (e) {
    error.value = formatAuthError(e);
  } finally {
    otpLoading.value = false;
  }
}

async function resendOtp() {
  otpResendLoading.value = true;
  try {
    await auth.sendEmailOtp(otpEmail.value || email.value.trim());
    ui.pushToast("OTP sent", `A new code was sent to ${otpEmail.value || email.value.trim()}.`, "success");
  } catch (e) {
    error.value = formatAuthError(e);
  } finally {
    otpResendLoading.value = false;
  }
}

function cancelOtpFlow() {
  otpRequired.value = false;
  otpCode.value = "";
  otpEmail.value = "";
  password.value = "";
  error.value = "";
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
        <p class="mt-1 text-sm text-slate-600">University event management portal</p>
      </div>

      <div class="auth-glass-card w-full max-w-md">
        <h2 class="text-lg font-semibold text-slate-900">Sign in</h2>
        <p class="mt-1 text-sm text-slate-600">Use your institutional email to continue.</p>

        <form v-if="!otpRequired" class="mt-6 space-y-4" @submit.prevent="onSubmit">
          <div>
            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" for="login-email"
              >Email</label
            >
            <div class="relative">
              <Mail class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="login-email"
                v-model="email"
                type="email"
                autocomplete="username"
                class="portal-input pl-10"
                placeholder="you@university.edu"
              />
            </div>
          </div>

          <div>
            <div class="mb-1 flex items-center justify-between gap-2">
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-500" for="login-password"
                >Password</label
              >
              <RouterLink
                to="/forgot-password"
                class="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
              >
                Forgot password?
              </RouterLink>
            </div>
            <div class="relative">
              <Lock class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="login-password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                class="portal-input pl-10 pr-11"
                placeholder="••••••••"
              />
              <button
                type="button"
                class="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                @click="showPassword = !showPassword"
              >
                <EyeOff v-if="showPassword" class="h-4 w-4" />
                <Eye v-else class="h-4 w-4" />
              </button>
            </div>
          </div>

          <p v-if="error" class="text-sm font-medium text-red-700">{{ error }}</p>
          <p v-if="isPasswordLocked" class="text-sm font-medium text-amber-700">
            Login temporarily locked due to repeated incorrect passwords. Wait {{ lockRemainingSeconds }}s before trying
            again.
          </p>

          <button
            v-if="showResendConfirm"
            type="button"
            class="portal-btn-secondary w-full text-sm"
            :disabled="resendLoading"
            @click="resendConfirmation"
          >
            {{ resendLoading ? "Sending…" : "Resend confirmation email" }}
          </button>

          <button type="submit" class="portal-btn w-full" :disabled="loading || isPasswordLocked">
            <ShieldCheck v-if="!loading" class="h-4 w-4" />
            <span v-if="loading">Signing in…</span>
            <span v-else>Continue</span>
          </button>
        </form>

        <form v-else class="mt-6 space-y-4" @submit.prevent="verifyOtpAndSignIn">
          <div>
            <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" for="login-otp"
              >Email OTP</label
            >
            <div class="relative">
              <ShieldCheck class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="login-otp"
                v-model="otpCode"
                type="text"
                inputmode="numeric"
                autocomplete="one-time-code"
                class="portal-input pl-10"
                placeholder="Enter 6-digit code"
              />
            </div>
            <p class="mt-1 text-xs text-slate-500">Code sent to {{ otpEmail || email }}</p>
          </div>

          <p v-if="error" class="text-sm font-medium text-red-700">{{ error }}</p>

          <button type="submit" class="portal-btn w-full" :disabled="otpLoading">
            <ShieldCheck v-if="!otpLoading" class="h-4 w-4" />
            <span v-if="otpLoading">Verifying…</span>
            <span v-else>Verify and continue</span>
          </button>

          <div class="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              class="portal-btn-secondary w-full text-sm"
              :disabled="otpResendLoading"
              @click="resendOtp"
            >
              {{ otpResendLoading ? "Sending…" : "Resend OTP" }}
            </button>
            <button type="button" class="portal-btn-secondary w-full text-sm" @click="cancelOtpFlow">
              Back to password login
            </button>
          </div>
        </form>

        <p class="mt-6 text-center text-sm text-slate-600">
          New student?
          <RouterLink to="/signup" class="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
            >Create an account</RouterLink
          >
        </p>
      </div>

      <p class="mt-8 text-center text-xs text-slate-500">
        <RouterLink to="/student" class="font-medium text-emerald-800 hover:underline">Browse events</RouterLink>
      </p>
    </div>
  </div>
</template>
