<script setup lang="ts">
import { ShieldCheck, Database, Bell } from "lucide-vue-next";
</script>

<template>
  <div class="dash-page">
    <div class="mb-6">
      <h1 class="text-3xl font-semibold text-gray-900">Settings</h1>
      <p class="text-sm text-slate-600">Live configuration and operational notes for production deployment.</p>
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <section class="dash-card p-5">
        <div class="mb-3 flex items-center gap-2">
          <ShieldCheck class="h-5 w-5 text-emerald-600" />
          <h2 class="text-base font-semibold text-slate-900">Security Controls</h2>
        </div>
        <ul class="space-y-2 text-sm text-slate-700">
          <li>Password + Email OTP required for non-student users (real email domains).</li>
          <li>Three failed password attempts trigger a 60-second lockout.</li>
          <li>Single active session enforcement is enabled for non-exempt email domains.</li>
          <li>New login security notifications are stored in-app.</li>
        </ul>
      </section>

      <section class="dash-card p-5">
        <div class="mb-3 flex items-center gap-2">
          <Bell class="h-5 w-5 text-blue-600" />
          <h2 class="text-base font-semibold text-slate-900">Operational Controls</h2>
        </div>
        <ul class="space-y-2 text-sm text-slate-700">
          <li>Create staff users from <span class="font-semibold">Admin - Users - Add user</span>.</li>
          <li>Reset credentials from the Users table action menu.</li>
          <li>Student registry import and management is in <span class="font-semibold">Admin - Students</span>.</li>
          <li>College/organization setup is in <span class="font-semibold">Admin - Colleges</span>.</li>
        </ul>
      </section>

      <section class="dash-card p-5">
        <div class="mb-3 flex items-center gap-2">
          <Database class="h-5 w-5 text-violet-600" />
          <h2 class="text-base font-semibold text-slate-900">Deployment Notes</h2>
        </div>
        <ul class="space-y-2 text-sm text-slate-700">
          <li>Database backups and retention are managed from the Supabase dashboard.</li>
          <li>Edge function <code>admin-create-user</code> must be deployed for in-app account creation.</li>
          <li>Apply new SQL migrations before release to keep schema and UI aligned.</li>
        </ul>
      </section>
    </div>
  </div>
</template>
