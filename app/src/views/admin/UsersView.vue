<script setup lang="ts">
import { computed, ref } from "vue";
import { Edit2, KeyRound, Plus, RefreshCw, Search } from "lucide-vue-next";
import AddUserModal from "./components/AddUserModal.vue";
import EditUserModal from "./components/EditUserModal.vue";
import StudentOfficerImportPanel from "./components/StudentOfficerImportPanel.vue";
import StaffImportPanel from "./components/StaffImportPanel.vue";
import PaginationControls from "@/components/PaginationControls.vue";
import { usePaginatedQuery } from "@/composables/usePaginatedQuery";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import { isSupabaseConfigured } from "@/lib/supabase";
import { adminRoleLabel, fetchAdminPortalUsersPage, type AdminPortalUserRow } from "@/services/adminUsersDb";
import type { AppRole } from "@/types/appRole";
import { emptyPage } from "@/types/pagination";
import PortalTableSkeleton from "@/components/portal/PortalTableSkeleton.vue";
import { toUserFacingError } from "@/utils/userFacingError";

type RoleFilter =
  | "All"
  | "Student Officer"
  | "SSC"
  | "Adviser"
  | "Dean"
  | "OSAS"
  | "EO"
  | "GSO"
  | "IT Infrastructure"
  | "Sports Office"
  | "Infirmary"
  | "NSTP"
  | "Admin";

type UserRow = {
  userId: string;
  name: string;
  role: string;
  appRole: AppRole;
  college: string;
  program: string;
  email: string;
};

const ROLE_FILTER_TO_APP_ROLE: Record<Exclude<RoleFilter, "All">, AppRole> = {
  "Student Officer": "student_officer",
  SSC: "ssc",
  Adviser: "adviser",
  Dean: "dean",
  OSAS: "osas",
  EO: "eo",
  GSO: "gso",
  "IT Infrastructure": "it_infrastructure",
  "Sports Office": "sports_office",
  Infirmary: "infirmary",
  NSTP: "nstp",
  Admin: "admin",
};

const selectedRole = ref<RoleFilter>("All");
const selectedCollege = ref("All");
const selectedProgram = ref("All");
const searchQuery = ref("");
const addUserOpen = ref(false);
const editUserOpen = ref(false);
const selectedUser = ref<UserRow | null>(null);
const auth = useAuthStore();
const ui = useUiStore();

const canLoad = computed(() => isSupabaseConfigured && !auth.useMock);

const serverRole = computed<AppRole | null>(() => {
  if (selectedRole.value === "All") return null;
  return ROLE_FILTER_TO_APP_ROLE[selectedRole.value] ?? null;
});

const {
  page,
  pageSize,
  loading,
  error: queryError,
  rows: rawRows,
  total,
  refresh,
  setPage,
  setPageSize,
} = usePaginatedQuery<AdminPortalUserRow, { role: AppRole | null }>({
  fetcher: (params) => {
    if (!canLoad.value) return Promise.resolve(emptyPage<AdminPortalUserRow>());
    return fetchAdminPortalUsersPage(params);
  },
  filters: computed(() => ({ role: serverRole.value })),
  search: searchQuery,
  immediate: canLoad.value,
});

const loadError = computed(() => {
  const err = queryError.value;
  if (!err) return null;
  return err;
});

const roles: RoleFilter[] = [
  "All",
  "Student Officer",
  "SSC",
  "Adviser",
  "Dean",
  "OSAS",
  "EO",
  "GSO",
  "IT Infrastructure",
  "Sports Office",
  "Infirmary",
  "NSTP",
  "Admin",
];

function mapRow(r: AdminPortalUserRow): UserRow {
  const label = adminRoleLabel(r.app_role);
  const name =
    (r.display_name && r.display_name.trim()) ||
    (r.email && r.email.trim()) ||
    r.user_id.slice(0, 8);
  return {
    userId: r.user_id,
    name,
    role: label,
    appRole: r.app_role as AppRole,
    college: r.college?.trim() || "—",
    program: r.program?.trim() || "—",
    email: r.email?.trim() || "—",
  };
}

const users = computed(() => rawRows.value.map(mapRow));

const collegeOptions = computed(() => {
  const set = new Set<string>();
  for (const u of users.value) {
    if (u.college && u.college !== "—") set.add(u.college);
  }
  return ["All", ...Array.from(set).sort()];
});

const programOptions = computed(() => {
  const set = new Set<string>();
  for (const u of users.value) {
    if (u.program && u.program !== "—") set.add(u.program);
  }
  return ["All", ...Array.from(set).sort()];
});

const filteredUsers = computed(() =>
  users.value.filter((user) => {
    const matchesCollege = selectedCollege.value === "All" || user.college === selectedCollege.value;
    const matchesProgram = selectedProgram.value === "All" || user.program === selectedProgram.value;
    return matchesCollege && matchesProgram;
  }),
);

function editUser(user: UserRow) {
  selectedUser.value = { ...user };
  editUserOpen.value = true;
}

async function resetUserPassword(user: UserRow) {
  if (!isSupabaseConfigured || auth.useMock) {
    ui.pushToast("Reset unavailable", "Password recovery is not available in this environment.", "warning");
    return;
  }
  if (!user.email || user.email === "—") {
    ui.pushToast("No email", "This account has no email on file.", "warning");
    return;
  }
  try {
    await auth.resetPassword(user.email);
    ui.pushToast("Reset link sent", `Check ${user.email} for password reset instructions.`, "success");
  } catch (e) {
    ui.pushToast("Could not send", toUserFacingError(e, "Try again."), "error");
  }
}
</script>

<template>
  <div class="dash-page dash-page-fill">
    <header class="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="portal-section-title">Administration</p>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Users</h1>
        <p class="mt-1 max-w-2xl text-sm text-slate-600">
          Directory of accounts with a portal role. Create new staff accounts from the
          <span class="font-semibold">Add user</span> modal.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-if="canLoad"
          type="button"
          class="portal-btn-secondary inline-flex items-center gap-2"
          :disabled="loading"
          @click="refresh()"
        >
          <RefreshCw class="h-4 w-4 shrink-0" :class="loading ? 'animate-spin' : ''" />
          Refresh
        </button>
        <button type="button" class="portal-btn inline-flex items-center gap-2" @click="addUserOpen = true">
          <Plus class="h-4 w-4 shrink-0" />
          Add user
        </button>
      </div>
    </header>

    <div v-if="canLoad" class="grid grid-cols-1 gap-3 md:grid-cols-3">
      <StudentOfficerImportPanel @imported="refresh()" />
      <StaffImportPanel kind="adviser" @imported="refresh()" />
      <StaffImportPanel kind="dean" @imported="refresh()" />
    </div>

    <p
      v-if="!canLoad"
      class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      Connect Supabase (<code class="text-xs">VITE_SUPABASE_URL</code>,
      <code class="text-xs">VITE_SUPABASE_ANON_KEY</code>) to load the live user directory.
    </p>

    <p
      v-else-if="loadError"
      class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
    >
      {{ loadError }}
    </p>

    <div class="dash-card shrink-0 p-4 sm:p-5">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        <div>
          <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Role</label>
          <select v-model="selectedRole" class="input-dash py-2">
            <option v-for="role in roles" :key="role" :value="role">{{ role }}</option>
          </select>
        </div>
        <div>
          <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">College</label>
          <select v-model="selectedCollege" class="input-dash py-2">
            <option v-for="c in collegeOptions" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div>
          <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Program</label>
          <select v-model="selectedProgram" class="input-dash py-2">
            <option v-for="p in programOptions" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>
        <div>
          <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Search</label>
          <div class="relative">
            <Search
              class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              v-model="searchQuery"
              type="search"
              placeholder="Name, email, role, user id…"
              class="input-dash pl-9 py-2"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="dash-card dash-card-fill min-h-0">
      <div class="min-h-0 flex-1 overflow-auto">
      <table class="portal-table min-w-0">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>College</th>
            <th>Program</th>
            <th>Email</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <PortalTableSkeleton v-if="loading" :rows="8" :columns="6" />
          <tr v-else-if="!loading && filteredUsers.length === 0">
            <td colspan="6" class="py-10 text-center text-sm text-slate-500">
              No users match your filters, or the directory is empty.
            </td>
          </tr>
          <template v-if="!loading">
          <tr v-for="user in filteredUsers" :key="user.userId">
            <td class="font-medium text-slate-900">{{ user.name }}</td>
            <td>
              <span
                class="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-600/15"
              >
                {{ user.role }}
              </span>
            </td>
            <td class="text-slate-600">{{ user.college }}</td>
            <td class="text-slate-600">{{ user.program }}</td>
            <td class="max-w-[12rem] truncate text-slate-600">{{ user.email }}</td>
            <td class="text-right">
              <div class="flex justify-end gap-1">
                <button
                  type="button"
                  class="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100"
                  title="Details"
                  @click="editUser(user)"
                >
                  <Edit2 class="h-4 w-4" />
                </button>
                <button
                  type="button"
                  class="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100"
                  title="Send password reset email"
                  @click="resetUserPassword(user)"
                >
                  <KeyRound class="h-4 w-4" />
                </button>
              </div>
            </td>
          </tr>
          </template>
        </tbody>
      </table>
      </div>
      <PaginationControls
        v-if="canLoad"
        :page="page"
        :page-size="pageSize"
        :total="total"
        :loading="loading"
        @update:page="setPage"
        @update:page-size="setPageSize"
      />
    </div>

    <p class="shrink-0 text-xs text-slate-500">Use the edit button to update role/assignment details for staff accounts.</p>

    <AddUserModal :open="addUserOpen" @close="addUserOpen = false" @created="refresh()" />
    <EditUserModal
      :open="editUserOpen"
      :user="selectedUser"
      @close="editUserOpen = false"
      @updated="refresh()"
    />
  </div>
</template>

