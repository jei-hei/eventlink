<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { X } from "lucide-vue-next";
import { useUiStore } from "@/stores/ui";
import { createPortalUser } from "@/services/adminCreateUser";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; created: [] }>();

const ui = useUiStore();

type RoleValue = "" | "student_officer" | "ssc" | "adviser" | "dean" | "osas" | "eo" | "gso" | "admin";

const role = ref<RoleValue>("");
const name = ref("");
const email = ref("");
const password = ref("");
const creating = ref(false);

const roleOptions: Array<{ label: string; value: Exclude<RoleValue, ""> }> = [
  { label: "Student Officer", value: "student_officer" },
  { label: "SSC", value: "ssc" },
  { label: "Adviser", value: "adviser" },
  { label: "Dean", value: "dean" },
  { label: "OSAS", value: "osas" },
  { label: "EO", value: "eo" },
  { label: "GSO", value: "gso" },
  { label: "Admin", value: "admin" },
];

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      role.value = "";
      name.value = "";
      email.value = "";
      password.value = "";
    }
  },
);
const roleLabel = computed(() => roleOptions.find((r) => r.value === role.value)?.label ?? "");

async function handleSubmit(e: Event) {
  e.preventDefault();
  if (creating.value) return;
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
  creating.value = true;
  try {
    await createPortalUser({
      role: role.value,
      email: email.value.trim(),
      password: password.value,
      displayName: name.value.trim(),
    });
    ui.pushToast("Account created", `${email.value.trim()} can now sign in.`, "success");
    emit("created");
    emit("close");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not create account.";
    ui.pushToast("Creation failed", msg, "error");
  } finally {
    creating.value = false;
  }
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
        <p class="font-semibold">Create staff account</p>
        <p class="mt-1 text-sky-900/90">
          This form creates a real Supabase auth user and assigns the selected portal role.
          Students should still use signup. Additional profile details can be completed after first login.
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
            <option v-for="opt in roleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>

        <div
          v-if="role === 'osas' || role === 'eo' || role === 'gso'"
          class="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
        >
          <p class="text-sm text-yellow-800">
            <strong>Note:</strong> Only one {{ roleLabel }} account can exist in the system.
          </p>
        </div>

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
            :disabled="creating"
            class="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {{ creating ? "Creating..." : "Create User" }}
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
