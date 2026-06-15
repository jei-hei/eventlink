<script setup lang="ts">
import { ref } from "vue";
import { Save, Bell, Shield, Database, Mail } from "lucide-vue-next";
import { useUiStore } from "@/stores/ui";

const ui = useUiStore();

const universityName = ref("University of Excellence");
const academicYear = ref("2025-2026");
const semester = ref("1st Semester");
const adminEmail = ref("admin@university.edu");
const supportEmail = ref("support@university.edu");
const emailNotifications = ref(true);
const activityAlerts = ref(true);
const autoBackup = ref(true);
const saving = ref(false);

function saveSettings() {
  saving.value = true;
  window.setTimeout(() => {
    saving.value = false;
    ui.pushToast("Settings saved", "Your preferences were stored for this session.", "success");
  }, 350);
}

function backupNow() {
  ui.pushToast(
    "Backup started",
    "Database backups are configured in the Supabase project dashboard.",
    "info",
  );
}
</script>

<template>
  <div class="p-8">
    <div class="mb-8">
      <h1 class="text-3xl font-semibold text-gray-900 mb-2">Settings</h1>
      <p class="text-gray-600">Manage system settings and preferences.</p>
    </div>

    <div class="space-y-6">
      <div class="bg-white rounded-lg shadow-sm border border-gray-200">
        <div class="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
          <Shield class="w-5 h-5 text-gray-700 shrink-0" />
          <h3 class="font-semibold text-lg text-gray-900">General Settings</h3>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">University Name</label>
            <input
              v-model="universityName"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Academic Year</label>
            <input
              v-model="academicYear"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Semester</label>
            <select
              v-model="semester"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>1st Semester</option>
              <option>2nd Semester</option>
              <option>Summer</option>
            </select>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200">
        <div class="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
          <Bell class="w-5 h-5 text-gray-700 shrink-0" />
          <h3 class="font-semibold text-lg text-gray-900">Notification Settings</h3>
        </div>
        <div class="p-6 space-y-4">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="font-medium text-gray-900">Email Notifications</p>
              <p class="text-sm text-gray-600">Receive email updates for new user registrations</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer shrink-0">
              <input v-model="emailNotifications" type="checkbox" class="sr-only peer" />
              <div
                class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
              />
            </label>
          </div>
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="font-medium text-gray-900">Account Activity Alerts</p>
              <p class="text-sm text-gray-600">
                Get notified when accounts are modified or deactivated
              </p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer shrink-0">
              <input v-model="activityAlerts" type="checkbox" class="sr-only peer" />
              <div
                class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
              />
            </label>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200">
        <div class="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
          <Mail class="w-5 h-5 text-gray-700 shrink-0" />
          <h3 class="font-semibold text-lg text-gray-900">Email Settings</h3>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Admin Email</label>
            <input
              v-model="adminEmail"
              type="email"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Support Email</label>
            <input
              v-model="supportEmail"
              type="email"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200">
        <div class="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
          <Database class="w-5 h-5 text-gray-700 shrink-0" />
          <h3 class="font-semibold text-lg text-gray-900">Database Settings</h3>
        </div>
        <div class="p-6 space-y-4">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="font-medium text-gray-900">Auto Backup</p>
              <p class="text-sm text-gray-600">Automatically backup database daily</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer shrink-0">
              <input v-model="autoBackup" type="checkbox" class="sr-only peer" />
              <div
                class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
              />
            </label>
          </div>
          <button
            type="button"
            class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            @click="backupNow"
          >
            Backup Now
          </button>
        </div>
      </div>

      <div class="flex justify-end">
        <button
          type="button"
          class="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
          :disabled="saving"
          @click="saveSettings"
        >
          <Save class="w-5 h-5" />
          {{ saving ? "Saving…" : "Save Settings" }}
        </button>
      </div>
    </div>
  </div>
</template>
