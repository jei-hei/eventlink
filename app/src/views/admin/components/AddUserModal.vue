<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { X, Plus } from "lucide-vue-next";
import { useUiStore } from "@/stores/ui";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const ui = useUiStore();

type Role = "" | "Student Officer" | "SSC" | "Adviser" | "Dean" | "OSAS" | "EO" | "GSO";

const role = ref<Role>("");
const college = ref("");
const program = ref("");
const organization = ref("");
const sscPosition = ref("");
const adviser = ref("");
const name = ref("");
const email = ref("");
const idNumber = ref("");
const password = ref("");
const customPosition = ref("");
const showCustomPositionInput = ref(false);

const colleges = [
  "College of Engineering",
  "College of Arts and Sciences",
  "College of Business",
  "College of Education",
];
const programs = [
  "Computer Science",
  "Information Technology",
  "Electronics Engineering",
  "Civil Engineering",
];
const organizations = [
  "Supreme Student Council",
  "Computer Science Society",
  "Information Technology Society",
  "Engineering Student Council",
  "Business Student Organization",
];
const sscPositions = [
  "President",
  "Vice President",
  "Secretary",
  "Treasurer",
  "Auditor",
  "Public Relations Officer",
];
const advisers = ["Dr. Mike Johnson", "Dr. Sarah Williams", "Dr. Tom Brown", "Dr. Robert Chen"];

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      role.value = "";
      college.value = "";
      program.value = "";
      organization.value = "";
      sscPosition.value = "";
      adviser.value = "";
      name.value = "";
      email.value = "";
      idNumber.value = "";
      password.value = "";
      customPosition.value = "";
      showCustomPositionInput.value = false;
    }
  },
);

const showCollegeField = computed(
  () =>
    role.value === "Student Officer" ||
    role.value === "Adviser" ||
    role.value === "Dean" ||
    role.value === "SSC",
);
const showProgramField = computed(
  () => role.value === "Student Officer" || role.value === "SSC",
);
const showOrganizationField = computed(
  () => role.value === "Student Officer" || role.value === "Adviser",
);
const showSSCFields = computed(() => role.value === "SSC");
const showOfficeField = computed(
  () => role.value === "OSAS" || role.value === "EO" || role.value === "GSO",
);

function handleAddCustomPosition() {
  if (customPosition.value.trim()) {
    sscPosition.value = customPosition.value.trim();
    customPosition.value = "";
    showCustomPositionInput.value = false;
  }
}

function handleSubmit(e: Event) {
  e.preventDefault();
  if (!role.value) {
    ui.pushToast("Select a role", "Choose the staff role for this account.", "error");
    return;
  }
  if (!name.value.trim() || !email.value.trim() || !password.value.trim()) {
    ui.pushToast("Missing fields", "Name, email, and password are required.", "error");
    return;
  }
  if (password.value.length < 8) {
    ui.pushToast("Weak password", "Use at least 8 characters.", "error");
    return;
  }
  if (showOrganizationField.value && !organization.value) {
    ui.pushToast("Select an organization", `Choose the organization for this ${role.value}.`, "error");
    return;
  }
  ui.pushToast(
    "Create this staff account",
    `Run in app folder: npm run create:user — email ${email.value.trim()}, role ${role.value}. Students sign up at /signup instead.`,
    "info",
  );
  emit("close");
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="add-user-title"
  >
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
        <h2 id="add-user-title" class="text-xl font-semibold text-gray-900">Add New User</h2>
        <button
          type="button"
          class="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Close"
          @click="emit('close')"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="space-y-4 p-6">
      <div class="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
        <p class="font-semibold">How to add staff</p>
        <p class="mt-1 text-sky-900/90">
          From the <code class="rounded bg-white/80 px-1 text-xs">app/</code> folder run
          <code class="rounded bg-white/80 px-1 text-xs">npm run create:user</code> with
          <code class="rounded bg-white/80 px-1 text-xs">SUPABASE_SERVICE_ROLE_KEY</code> in
          <code class="rounded bg-white/80 px-1 text-xs">.env.seed</code>. See
          <code class="rounded bg-white/80 px-1 text-xs">supabase/STEP_03_STAFF.md</code>.
        </p>
      </div>

      <form class="space-y-4" @submit="handleSubmit">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Role <span class="text-red-500">*</span>
          </label>
          <select
            v-model="role"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Role</option>
            <option value="Student Officer">Student Officer</option>
            <option value="SSC">SSC</option>
            <option value="Adviser">Adviser</option>
            <option value="Dean">Dean</option>
            <option value="OSAS">OSAS</option>
            <option value="EO">EO</option>
            <option value="GSO">GSO</option>
          </select>
        </div>

        <div v-if="showCollegeField">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            College <span class="text-red-500">*</span>
          </label>
          <select
            v-model="college"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select College</option>
            <option v-for="c in colleges" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>

        <div v-if="showProgramField">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Program <span class="text-red-500">*</span>
          </label>
          <select
            v-model="program"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Program</option>
            <option v-for="p in programs" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>

        <div v-if="showOrganizationField">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Organization <span class="text-red-500">*</span>
          </label>
          <select
            v-model="organization"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Organization</option>
            <option v-for="o in organizations" :key="o" :value="o">{{ o }}</option>
          </select>
        </div>

        <template v-if="showSSCFields">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              SSC Position <span class="text-red-500">*</span>
            </label>
            <select
              v-model="sscPosition"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Position</option>
              <option v-for="p in sscPositions" :key="p" :value="p">{{ p }}</option>
            </select>
            <button
              v-if="!showCustomPositionInput"
              type="button"
              class="mt-2 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
              @click="showCustomPositionInput = true"
            >
              <Plus class="w-4 h-4" />
              Add New Position
            </button>
          </div>

          <div v-if="showCustomPositionInput" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Custom Position Name</label>
            <div class="flex gap-2 flex-wrap">
              <input
                v-model="customPosition"
                type="text"
                placeholder="Enter position name"
                class="flex-1 min-w-[12rem] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                @click="handleAddCustomPosition"
              >
                Add
              </button>
              <button
                type="button"
                class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                @click="showCustomPositionInput = false"
              >
                Cancel
              </button>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Assign Adviser <span class="text-red-500">*</span>
            </label>
            <select
              v-model="adviser"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Adviser</option>
              <option v-for="a in advisers" :key="a" :value="a">{{ a }}</option>
            </select>
          </div>
        </template>

        <div v-if="showOfficeField" class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p class="text-sm text-yellow-800">
            <strong>Note:</strong> Only one {{ role }} account can exist in the system.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Full Name <span class="text-red-500">*</span>
            </label>
            <input
              v-model="name"
              type="text"
              required
              placeholder="Juan dela Cruz"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              ID Number <span class="text-red-500">*</span>
            </label>
            <input
              v-model="idNumber"
              type="text"
              required
              placeholder="2024-00001"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Email <span class="text-red-500">*</span>
          </label>
          <input
            v-model="email"
            type="email"
            required
            placeholder="user@university.edu"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Password <span class="text-red-500">*</span>
          </label>
          <input
            v-model="password"
            type="password"
            required
            placeholder="Min. 8 characters"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div class="flex gap-3 pt-4">
          <button
            type="submit"
            class="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create User
          </button>
          <button
            type="button"
            class="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
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
