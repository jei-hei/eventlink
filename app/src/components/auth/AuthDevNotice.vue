<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const show = import.meta.env.DEV && auth.isSupabaseConfigured && !auth.useMock;
</script>

<template>
  <div
    v-if="show"
    class="mt-4 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 text-left text-xs text-amber-950"
    role="note"
  >
    <p class="font-semibold">Development</p>
    <p class="mt-1 leading-relaxed text-amber-900/90">
      Step 1: turn off <strong>Confirm email</strong> under Authentication → Providers → Email.
    </p>
    <p class="mt-1 text-amber-800/90">
      Guides: <code class="rounded bg-amber-100/80 px-1">supabase/STEP_01_DEV_AUTH.md</code>,
      <code class="rounded bg-amber-100/80 px-1">STEP_02_REGISTRY.md</code>
    </p>
  </div>
</template>
