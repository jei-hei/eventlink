<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { Eye, Search } from "lucide-vue-next";
import { useAuthStore } from "@/stores/auth";
import { useEventRequestsStore } from "@/stores/eventRequests";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { PortalEvent } from "@/types/portalEvent";
import { resourceOfficeLabel } from "@/types/resourceOffice";
import EventLetterLink from "@/components/EventLetterLink.vue";
import PortalTableSkeleton from "@/components/portal/PortalTableSkeleton.vue";

const auth = useAuthStore();
const store = useEventRequestsStore();

const loading = ref(true);
const selected = ref<PortalEvent | null>(null);
const search = ref("");

async function refresh(force = false) {
  if (!isSupabaseConfigured || !auth.userId || !auth.appRole) {
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    await store.load(force);
  } finally {
    loading.value = false;
  }
}

onMounted(() => void refresh(true));

const events = computed(() => {
  if (!auth.userId || !auth.appRole) return [];
  if (auth.appRole === "student") {
    return store.monitoringForRole("student", auth.userId);
  }
  return store.monitoringForRole(auth.appRole, auth.userId);
});

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return events.value;
  return events.value.filter((e) => {
    return (
      e.name.toLowerCase().includes(q) ||
      (e.organization ?? "").toLowerCase().includes(q) ||
      (e.venue ?? "").toLowerCase().includes(q) ||
      String(e.workflowStatus ?? e.status).toLowerCase().includes(q)
    );
  });
});

function statusClass(status: string) {
  const s = status.toLowerCase();
  if (s.includes("cancel")) return "bg-slate-200 text-slate-800";
  if (s.includes("schedul") || s.includes("approved")) return "bg-emerald-100 text-emerald-800";
  if (s.includes("reject") || s.includes("declin")) return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
}

function resourceApprovalSummary(event: PortalEvent) {
  const assignments = event.resourceAssignments ?? [];
  if (!assignments.length) return [];
  const byOffice = new Map<string, { label: string; pending: number; approved: number; declined: number }>();
  for (const a of assignments) {
    const key = a.assignedOffice;
    const cur = byOffice.get(key) ?? {
      label: resourceOfficeLabel(a.assignedOffice),
      pending: 0,
      approved: 0,
      declined: 0,
    };
    if (a.status === "pending") cur.pending += 1;
    else if (a.status === "approved") cur.approved += 1;
    else cur.declined += 1;
    byOffice.set(key, cur);
  }
  return [...byOffice.values()];
}

function fmtUpdated(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

onUnmounted(() => {
  selected.value = null;
});
</script>

<template>
  <div class="dash-page">
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="portal-section-title">Oversight</p>
        <h1 class="text-xl font-bold text-slate-900 sm:text-2xl">Event Monitoring</h1>
        <p class="mt-1 text-sm text-slate-600">View event progress and status. This module does not approve or decline requests.</p>
      </div>
      <div class="relative w-full sm:max-w-xs">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          v-model="search"
          type="search"
          class="input-dash w-full pl-9"
          placeholder="Search events"
        />
      </div>
    </div>

    <div class="dash-card overflow-hidden">
      <div class="min-h-0 overflow-auto">
        <table class="w-full min-w-[48rem] text-left">
          <thead class="sticky top-0 z-10 bg-slate-50">
            <tr>
              <th class="border-r border-slate-200 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">Event</th>
              <th class="border-r border-slate-200 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">Organization</th>
              <th class="border-r border-slate-200 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">Date</th>
              <th class="border-r border-slate-200 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">Venue</th>
              <th class="border-r border-slate-200 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">Status</th>
              <th class="border-r border-slate-200 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">Updated</th>
              <th class="px-3 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            <PortalTableSkeleton v-if="loading" :rows="6" :columns="7" />
            <tr v-else-if="!filtered.length">
              <td colspan="7" class="py-12 text-center text-sm text-slate-400">No events to monitor</td>
            </tr>
            <tr
              v-for="event in filtered"
              v-else
              :key="event.id"
              class="cursor-pointer border-b border-slate-100 transition hover:bg-emerald-50/50"
              @click="selected = event"
            >
              <td class="border-r border-slate-100 px-3 py-2.5 text-sm font-medium text-slate-800">{{ event.name }}</td>
              <td class="border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600">{{ event.organization || "—" }}</td>
              <td class="border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600">{{ event.date }}</td>
              <td class="border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600">{{ event.venue || "—" }}</td>
              <td class="border-r border-slate-100 px-3 py-2.5 text-sm">
                <span :class="['rounded-full px-2 py-0.5 text-xs font-semibold', statusClass(String(event.workflowStatus ?? event.status))]">
                  {{ event.workflowStatus ?? event.status }}
                </span>
              </td>
              <td class="border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600">{{ fmtUpdated(event.updatedAt) }}</td>
              <td class="px-3 py-2 text-center" @click.stop>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  @click="selected = event"
                >
                  <Eye :size="12" /> View
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div
      v-if="selected"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="selected = null"
    >
      <div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-2xl">
        <div class="flex items-center justify-between bg-emerald-600 px-6 py-4 text-white">
          <h3 class="text-base font-bold">Event details</h3>
          <button type="button" class="rounded-lg p-1.5 hover:bg-emerald-700" @click="selected = null">✕</button>
        </div>
        <div class="space-y-3 p-6 text-sm">
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-gray-500">Event</p>
            <p class="font-medium text-gray-800">{{ selected.name }}</p>
          </div>
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-gray-500">Organization</p>
            <p class="font-medium text-gray-800">{{ selected.organization || "—" }}</p>
          </div>
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-gray-500">Date / venue</p>
            <p class="font-medium text-gray-800">{{ selected.date }} · {{ selected.venue || "—" }}</p>
          </div>
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-gray-500">Current status</p>
            <p class="font-medium text-gray-800">{{ selected.workflowStatus ?? selected.status }}</p>
          </div>
          <div v-if="resourceApprovalSummary(selected).length">
            <p class="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">Resource approvals</p>
            <ul class="space-y-1">
              <li
                v-for="office in resourceApprovalSummary(selected)"
                :key="office.label"
                class="text-sm text-gray-700"
              >
                <span v-if="office.pending">● {{ office.label }} — Pending</span>
                <span v-else-if="office.declined">✗ {{ office.label }} — Declined</span>
                <span v-else>✓ {{ office.label }}</span>
              </li>
            </ul>
          </div>
          <div v-if="selected.cancellationReason">
            <p class="text-xs font-bold uppercase tracking-wider text-gray-500">Cancellation note</p>
            <p class="font-medium text-gray-800">{{ selected.cancellationReason }}</p>
          </div>
          <div v-if="selected.letterPath">
            <p class="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">Current letter / document</p>
            <EventLetterLink :letter-path="selected.letterPath" />
          </div>
          <div v-if="selected.letterHistory?.length">
            <p class="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">Document history</p>
            <ul class="space-y-1">
              <li v-for="doc in selected.letterHistory" :key="doc.id" class="text-sm">
                <EventLetterLink :letter-path="doc.letterPath" :label="doc.label" />
              </li>
            </ul>
          </div>
        </div>
        <div class="flex justify-end border-t border-gray-200 bg-gray-50 px-6 py-4">
          <button type="button" class="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold" @click="selected = null">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
