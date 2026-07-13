<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RefreshCw, ShieldCheck } from "lucide-vue-next";
import { fetchAdminPortalUsers, type AdminPortalUserRow } from "@/services/adminUsersDb";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const loading = ref(false);
const loadError = ref<string | null>(null);
const rows = ref<AdminPortalUserRow[]>([]);

const sscUsers = computed(() => rows.value.filter((r) => r.app_role === "ssc"));
const advisers = computed(() => rows.value.filter((r) => r.app_role === "adviser"));

async function load() {
  if (!isSupabaseConfigured || auth.useMock) {
    rows.value = [];
    loadError.value = null;
    return;
  }
  loading.value = true;
  loadError.value = null;
  try {
    rows.value = await fetchAdminPortalUsers();
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : "Failed to load SSC accounts.";
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
});

function displayName(row: AdminPortalUserRow): string {
  return row.display_name?.trim() || row.email?.trim() || row.user_id.slice(0, 8);
}
</script>

<template>
  <div class="dash-page">
    <header class="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-3xl font-semibold text-slate-900">SSC Management</h1>
        <p class="text-sm text-slate-600">
          Live view of SSC and adviser accounts. Create or update accounts in <span class="font-semibold">Admin - Users</span>.
        </p>
      </div>
      <button
        type="button"
        class="portal-btn-secondary inline-flex items-center gap-2"
        :disabled="loading"
        @click="load()"
      >
        <RefreshCw class="h-4 w-4" :class="loading ? 'animate-spin' : ''" />
        Refresh
      </button>
    </header>

    <p
      v-if="!isSupabaseConfigured || auth.useMock"
      class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      Connect Supabase to load live SSC account data.
    </p>

    <p v-else-if="loadError" class="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
      {{ loadError }}
    </p>

    <section class="dash-card p-5">
      <div class="mb-3 flex items-center gap-2">
        <ShieldCheck class="h-5 w-5 text-violet-600" />
        <h2 class="text-base font-semibold text-slate-900">Current SSC Accounts</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="portal-table min-w-0">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>College</th>
              <th>Program</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="4" class="py-8 text-center text-sm text-slate-500">Loading...</td>
            </tr>
            <tr v-else-if="sscUsers.length === 0">
              <td colspan="4" class="py-8 text-center text-sm text-slate-500">No SSC accounts found.</td>
            </tr>
            <tr v-for="u in sscUsers" :key="u.user_id">
              <td class="font-medium text-slate-900">{{ displayName(u) }}</td>
              <td class="text-slate-600">{{ u.email || "—" }}</td>
              <td class="text-slate-600">{{ u.college || "—" }}</td>
              <td class="text-slate-600">{{ u.program || "—" }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="dash-card mt-4 p-5">
      <h2 class="mb-3 text-base font-semibold text-slate-900">Available Adviser Accounts</h2>
      <div class="overflow-x-auto">
        <table class="portal-table min-w-0">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>College</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="3" class="py-8 text-center text-sm text-slate-500">Loading...</td>
            </tr>
            <tr v-else-if="advisers.length === 0">
              <td colspan="3" class="py-8 text-center text-sm text-slate-500">No adviser accounts found.</td>
            </tr>
            <tr v-for="u in advisers" :key="u.user_id">
              <td class="font-medium text-slate-900">{{ displayName(u) }}</td>
              <td class="text-slate-600">{{ u.email || "—" }}</td>
              <td class="text-slate-600">{{ u.college || "—" }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
