<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { APP_ROLE_LABEL, APP_ROLES, ROLE_HOME_PATH, type AppRole } from "@/types/appRole";
import { useAuthStore } from "@/stores/auth";
import { listWalkthroughAccounts, openWalkthroughPortal, type WalkthroughAccountChoice } from "@/services/walkthroughDb";
import { toUserFacingError } from "@/utils/userFacingError";

const router = useRouter();
const auth = useAuthStore();

const roles = APP_ROLES.filter((role) => role !== "admin");
const selectedRole = ref<AppRole | null>(null);
const accounts = ref<WalkthroughAccountChoice[]>([]);
const loading = ref(false);
const openingId = ref<string | null>(null);
const error = ref("");

const selectedLabel = computed(() => (selectedRole.value ? APP_ROLE_LABEL[selectedRole.value] : ""));

function placeLine(account: WalkthroughAccountChoice): string {
  return [account.collegeName, account.organizationName, account.program].filter(Boolean).join(" · ");
}

async function chooseRole(role: AppRole) {
  if (loading.value || openingId.value) return;
  selectedRole.value = role;
  accounts.value = [];
  error.value = "";
  loading.value = true;
  try {
    accounts.value = await listWalkthroughAccounts(role);
  } catch (e) {
    error.value = toUserFacingError(e, "Could not load accounts for that role.");
  } finally {
    loading.value = false;
  }
}

async function openAccount(account: WalkthroughAccountChoice) {
  if (!selectedRole.value || openingId.value) return;
  openingId.value = account.userId;
  error.value = "";
  try {
    const opened = await openWalkthroughPortal(account.userId);
    auth.adoptWalkthroughPortal(opened);
    await router.push(ROLE_HOME_PATH[opened.role]);
  } catch (e) {
    error.value = toUserFacingError(e, "Could not open that account.");
    openingId.value = null;
  }
}

async function signOut() {
  await auth.signOut();
  await router.push({ name: "login" });
}
</script>

<template>
  <div class="min-h-screen bg-slate-950 px-4 py-10 text-slate-900">
    <div class="mx-auto w-full max-w-3xl">
      <div class="mb-6 flex items-start justify-between gap-4 text-white">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Walkthrough</p>
          <h1 class="mt-1 text-3xl font-semibold">Choose a portal</h1>
          <p class="mt-2 max-w-xl text-sm text-slate-300">
            Pick a role, then the account to open. The list shows a name and where that person belongs.
          </p>
        </div>
        <button type="button" class="shrink-0 rounded-lg border border-white/20 px-3 py-2 text-sm text-white" @click="signOut">
          Sign out
        </button>
      </div>

      <section class="rounded-2xl bg-white p-5 shadow-xl">
        <h2 class="text-sm font-semibold text-slate-800">Role</h2>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            v-for="role in roles"
            :key="role"
            type="button"
            class="rounded-full border px-3 py-1.5 text-sm font-medium"
            :class="
              selectedRole === role
                ? 'border-emerald-700 bg-emerald-700 text-white'
                : 'border-slate-200 bg-slate-50 text-slate-700'
            "
            :disabled="!!openingId"
            @click="chooseRole(role)"
          >
            {{ APP_ROLE_LABEL[role] }}
          </button>
        </div>

        <div class="mt-6">
          <h2 class="text-sm font-semibold text-slate-800">
            {{ selectedRole ? selectedLabel : "Accounts" }}
          </h2>
          <p v-if="!selectedRole" class="mt-2 text-sm text-slate-500">Choose a role to see its accounts.</p>
          <p v-else-if="loading" class="mt-2 text-sm text-slate-500">Loading accounts…</p>
          <p v-else-if="!accounts.length && !error" class="mt-2 text-sm text-slate-500">No accounts use this role yet.</p>
          <ul v-else class="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
            <li v-for="account in accounts" :key="account.userId">
              <button
                type="button"
                class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 disabled:opacity-60"
                :disabled="!!openingId"
                @click="openAccount(account)"
              >
                <span class="min-w-0">
                  <span class="block truncate text-sm font-semibold text-slate-900">{{ account.displayName }}</span>
                  <span v-if="placeLine(account)" class="block truncate text-xs text-slate-500">{{ placeLine(account) }}</span>
                </span>
                <span class="shrink-0 text-xs font-semibold text-emerald-700">
                  {{ openingId === account.userId ? "Opening…" : "Open" }}
                </span>
              </button>
            </li>
          </ul>
          <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>
        </div>
      </section>
    </div>
  </div>
</template>
