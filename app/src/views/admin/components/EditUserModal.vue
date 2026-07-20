<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { X } from "lucide-vue-next";
import { useUiStore } from "@/stores/ui";
import { updatePortalUser } from "@/services/adminCreateUser";
import { fetchCollegesWithOrganizations, type CollegeWithOrgs } from "@/services/collegesDb";
import type { AppRole } from "@/types/appRole";
import { adminRoleLabel } from "@/services/adminUsersDb";

type EditableRole = "student_officer" | "ssc" | "adviser" | "dean" | "osas" | "eo" | "gso" | "admin";

type EditableUser = {
  userId: string;
  appRole: AppRole;
  name: string;
  email: string;
  college: string;
  program: string;
};

const props = defineProps<{
  open: boolean;
  user: EditableUser | null;
}>();
const emit = defineEmits<{ close: []; updated: [] }>();

const ui = useUiStore();
const saving = ref(false);
const loadingOptions = ref(false);
const colleges = ref<CollegeWithOrgs[]>([]);

const role = ref<EditableRole>("adviser");
const name = ref("");
const email = ref("");
const collegeId = ref("");
const organizationId = ref("");

const roleOptions: Array<{ label: string; value: EditableRole }> = [
  { label: "Student Officer", value: "student_officer" },
  { label: "SSC", value: "ssc" },
  { label: "Adviser", value: "adviser" },
  { label: "Dean", value: "dean" },
  { label: "OSAS", value: "osas" },
  { label: "EO", value: "eo" },
  { label: "GSO", value: "gso" },
  { label: "Admin", value: "admin" },
];

const requiresCollege = computed(
  () => role.value === "student_officer" || role.value === "adviser" || role.value === "dean",
);
const requiresOrganization = computed(
  () => role.value === "student_officer" || role.value === "adviser",
);
const organizationOptions = computed(() => {
  const selected = colleges.value.find((c) => c.id === collegeId.value);
  return selected?.organizations ?? [];
});
const isStudentRole = computed(() => props.user?.appRole === "student");
const currentRoleLabel = computed(() => adminRoleLabel(props.user?.appRole ?? ""));

function coerceEditableRole(value: AppRole): EditableRole | null {
  if (value === "student") return null;
  return value;
}

function resetForm() {
  if (!props.user) return;
  const initialRole = coerceEditableRole(props.user.appRole);
  role.value = initialRole ?? "adviser";
  name.value = props.user.name;
  email.value = props.user.email;
  collegeId.value = "";
  organizationId.value = "";
}

function prefillCollegeAndOrganizationByName() {
  if (!props.user) return;
  if (!requiresCollege.value) return;

  const targetCollege = props.user.college.trim().toLowerCase();
  const selectedCollege = colleges.value.find((c) => c.name.trim().toLowerCase() === targetCollege);
  if (!selectedCollege) return;
  collegeId.value = selectedCollege.id;

  if (!requiresOrganization.value) return;
  const targetOrg = props.user.program.trim().toLowerCase();
  const selectedOrg = selectedCollege.organizations.find((o) => o.name.trim().toLowerCase() === targetOrg);
  if (!selectedOrg) return;
  organizationId.value = selectedOrg.id;
}

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return;
    resetForm();
    loadingOptions.value = true;
    try {
      colleges.value = await fetchCollegesWithOrganizations();
      prefillCollegeAndOrganizationByName();
    } catch {
      colleges.value = [];
    } finally {
      loadingOptions.value = false;
    }
  },
);

watch(role, () => {
  if (!requiresCollege.value) {
    collegeId.value = "";
    organizationId.value = "";
    return;
  }
  if (!requiresOrganization.value) {
    organizationId.value = "";
  }
});

watch(collegeId, () => {
  if (!organizationOptions.value.some((x) => x.id === organizationId.value)) {
    organizationId.value = "";
  }
});

async function submitEdit(e: Event) {
  e.preventDefault();
  if (!props.user || saving.value) return;
  if (isStudentRole.value) {
    ui.pushToast("Not editable here", "Student role/account edits are not supported in this modal.", "warning");
    return;
  }
  if (!name.value.trim()) {
    ui.pushToast("Missing fields", "Full name is required.", "error");
    return;
  }
  if (!email.value.trim() || email.value === "—") {
    ui.pushToast("Missing email", "This account has no valid email to update.", "error");
    return;
  }
  if (requiresCollege.value && !collegeId.value) {
    ui.pushToast("Missing fields", "Select a college for this role.", "error");
    return;
  }
  if (requiresOrganization.value && !organizationId.value) {
    ui.pushToast("Missing fields", "Select an organization for this role.", "error");
    return;
  }

  saving.value = true;
  try {
    await updatePortalUser({
      userId: props.user.userId,
      role: role.value,
      email: email.value.trim(),
      displayName: name.value.trim(),
      collegeId: collegeId.value || null,
      organizationId: organizationId.value || null,
    });
    ui.pushToast("User updated", "Account details were saved.", "success");
    emit("updated");
    emit("close");
  } catch (err) {
    ui.pushToast("Update failed", err instanceof Error ? err.message : "Could not update account.", "error");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="edit-user-title"
  >
    <div class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
      <div class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <h2 id="edit-user-title" class="text-xl font-semibold text-gray-900">Edit User Details</h2>
        <button
          type="button"
          class="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100"
          aria-label="Close"
          @click="emit('close')"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <div class="space-y-4 p-6">
        <div class="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          <p class="font-semibold">Update account assignment</p>
          <p class="mt-1 text-sky-900/90">
            Use this to fix role mapping and align adviser/dean/officer with the correct college and organization.
          </p>
        </div>

        <div v-if="isStudentRole" class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This account is currently <strong>{{ currentRoleLabel }}</strong
          >. Student accounts are not editable from this modal.
        </div>

        <form class="space-y-4" @submit="submitEdit">
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700">Role <span class="text-red-500">*</span></label>
            <select
              v-model="role"
              required
              :disabled="isStudentRole"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option v-for="opt in roleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>

          <div v-if="requiresCollege">
            <label class="mb-2 block text-sm font-medium text-gray-700">College <span class="text-red-500">*</span></label>
            <select
              v-model="collegeId"
              required
              :disabled="isStudentRole"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="">Select college</option>
              <option v-for="c in colleges" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
            <p v-if="loadingOptions" class="mt-1 text-xs text-slate-500">Loading colleges...</p>
          </div>

          <div v-if="requiresOrganization">
            <label class="mb-2 block text-sm font-medium text-gray-700">
              Organization <span class="text-red-500">*</span>
            </label>
            <select
              v-model="organizationId"
              required
              :disabled="isStudentRole || !collegeId"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="">{{ collegeId ? "Select organization" : "Select college first" }}</option>
              <option v-for="org in organizationOptions" :key="org.id" :value="org.id">
                {{ org.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700">
              Full Name <span class="text-red-500">*</span>
            </label>
            <input
              v-model="name"
              type="text"
              required
              :disabled="isStudentRole"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700">Email</label>
            <input
              v-model="email"
              type="email"
              disabled
              class="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-gray-600"
            />
          </div>

          <div class="flex gap-3 pt-4">
            <button
              type="submit"
              :disabled="saving || isStudentRole"
              class="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {{ saving ? "Saving..." : "Save Changes" }}
            </button>
            <button
              type="button"
              class="rounded-lg bg-gray-200 px-6 py-3 text-gray-700 transition-colors hover:bg-gray-300"
              @click="emit('close')"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
