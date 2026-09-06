<script setup lang="ts">

import { computed, onMounted, ref, watch } from "vue";

import { GitBranch, Search } from "lucide-vue-next";

import PaginationControls from "@/components/PaginationControls.vue";

import PortalEmptyState from "@/components/portal/PortalEmptyState.vue";

import {

  appRoleToEventsLogScope,

  fetchEventTrail,

  fetchRecentEventsInScope,

  type EventTrailEntry,

  type RecentEventOption,

} from "@/services/eventsLogDb";

import type { AppRole } from "@/types/appRole";

import { DEFAULT_PAGE_SIZE } from "@/types/pagination";

import { toUserFacingError } from "@/utils/userFacingError";



const props = defineProps<{

  role: AppRole;

  collegeId?: string | null;

  organizationId?: string | null;

  userId?: string | null;

}>();



const requestIdInput = ref("");

const selectedRequestId = ref<string | null>(null);

const recentEvents = ref<RecentEventOption[]>([]);

const trail = ref<EventTrailEntry[]>([]);

const loading = ref(false);

const error = ref<string | null>(null);

const page = ref(1);

const pageSize = ref(DEFAULT_PAGE_SIZE);

const total = ref(0);



const analyticsScope = computed(() => appRoleToEventsLogScope(props.role));



const scopePayload = computed(() => {

  const role = analyticsScope.value;

  if (!role) return null;

  return {

    role,

    collegeId: props.collegeId,

    organizationId: props.organizationId,

    userId: props.userId,

  };

});



function formatDate(iso: string): string {

  return new Date(iso).toLocaleString("en-US", {

    month: "short",

    day: "numeric",

    year: "numeric",

    hour: "numeric",

    minute: "2-digit",

  });

}



function metadataField(entry: EventTrailEntry, ...keys: string[]): string | null {

  for (const key of keys) {

    const val = entry.metadata[key];

    if (typeof val === "string" && val.trim()) return val.trim();

  }

  return null;

}



function scheduleChanges(entry: EventTrailEntry): { label: string; from: string; to: string }[] {

  const pairs: [string, string[], string[]][] = [

    ["Venue", ["old_venue", "previous_venue"], ["new_venue", "venue"]],

    ["Start date", ["old_start_date", "previous_start_date"], ["new_start_date", "start_date"]],

    ["End date", ["old_end_date", "previous_end_date"], ["new_end_date", "end_date"]],

    ["Start time", ["old_start_time", "previous_start_time"], ["new_start_time", "start_time"]],

    ["End time", ["old_end_time", "previous_end_time"], ["new_end_time", "end_time"]],

  ];

  const out: { label: string; from: string; to: string }[] = [];

  for (const [label, fromKeys, toKeys] of pairs) {

    const from = metadataField(entry, ...fromKeys);

    const to = metadataField(entry, ...toKeys);

    if (from || to) out.push({ label, from: from ?? "—", to: to ?? "—" });

  }

  return out;

}



function isCancelled(entry: EventTrailEntry): boolean {

  return entry.action === "cancelled";

}



function isUpdated(entry: EventTrailEntry): boolean {

  return entry.action === "updated" || entry.actionLabel === "Rescheduled" || entry.actionLabel === "Edited";

}



async function loadRecentEvents() {

  const scope = scopePayload.value;

  if (!scope) {

    recentEvents.value = [];

    return;

  }

  try {

    recentEvents.value = await fetchRecentEventsInScope(scope);

  } catch {

    recentEvents.value = [];

  }

}



async function loadTrail(id?: string | null) {

  const target = (id ?? selectedRequestId.value ?? requestIdInput.value).trim();

  if (!target) {

    trail.value = [];

    total.value = 0;

    return;

  }



  const scope = scopePayload.value;

  if (!scope) {

    trail.value = [];

    total.value = 0;

    error.value = "Event trail is not available for this role.";

    return;

  }



  loading.value = true;

  error.value = null;

  try {

    const result = await fetchEventTrail(target, scope, { page: page.value, pageSize: pageSize.value });

    trail.value = result.rows;

    total.value = result.total;

    page.value = result.page;

    pageSize.value = result.pageSize;

    selectedRequestId.value = target;

    if (!result.total) {

      error.value = "No trail found for this request in your scope.";

    }

  } catch (e) {

    trail.value = [];

    total.value = 0;

    error.value = toUserFacingError(e, "Could not load event trail.");

  } finally {

    loading.value = false;

  }

}



function onSelectRecent() {

  if (selectedRequestId.value) {

    requestIdInput.value = selectedRequestId.value;

    page.value = 1;

    void loadTrail(selectedRequestId.value);

  }

}



function onSearch() {

  page.value = 1;

  void loadTrail(requestIdInput.value);

}



onMounted(() => {

  void loadRecentEvents();

});



watch(

  () => [props.role, props.collegeId, props.organizationId, props.userId],

  () => {

    void loadRecentEvents();

    trail.value = [];

    total.value = 0;

    page.value = 1;

  },

);



watch([page, pageSize], () => {

  const target = selectedRequestId.value ?? requestIdInput.value.trim();

  if (target) void loadTrail(target);

});

</script>



<template>

  <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">

    <div class="flex items-center gap-2">

      <div class="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">

        <GitBranch :size="16" class="text-indigo-700" />

      </div>

      <div>

        <h3 class="font-bold text-gray-800 text-sm">Event Trail</h3>

        <p class="text-gray-400 text-xs">Full action history for a single event request</p>

      </div>

    </div>



    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">

      <label class="text-[11px] text-gray-500 space-y-1">

        <span>Search by request ID</span>

        <div class="flex gap-2">

          <input

            v-model="requestIdInput"

            type="text"

            placeholder="Paste UUID…"

            class="flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-xs font-mono"

            @keyup.enter="onSearch"

          />

          <button

            type="button"

            class="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"

            @click="onSearch"

          >

            <Search :size="14" />

            Load

          </button>

        </div>

      </label>

      <label class="text-[11px] text-gray-500 space-y-1">

        <span>Or pick a recent event</span>

        <select

          v-model="selectedRequestId"

          class="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs"

          @change="onSelectRecent"

        >

          <option :value="null">Select event…</option>

          <option v-for="ev in recentEvents" :key="ev.id" :value="ev.id">

            {{ ev.activity }} · {{ ev.organizationName }} ({{ ev.status }})

          </option>

        </select>

      </label>

    </div>



    <p v-if="error" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">

      {{ error }}

    </p>



    <div v-if="loading" class="text-center text-xs text-gray-500 py-8">Loading event trail…</div>



    <PortalEmptyState

      v-else-if="!trail.length"

      title="Select an event to view its trail"

      description="Use the request ID search or recent events dropdown to inspect workflow history."

    />



    <template v-else>

      <ol class="relative border-l-2 border-indigo-100 ml-3 space-y-4 pl-5">

        <li v-for="(entry, idx) in trail" :key="entry.id" class="relative">

          <span

            class="absolute -left-[1.35rem] top-1.5 w-3 h-3 rounded-full border-2 border-white bg-indigo-500 shadow-sm"

          />

          <div class="rounded-lg border border-gray-100 bg-gray-50/50 p-3 space-y-2">

            <div class="flex flex-wrap items-center gap-2">

              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">

                {{ entry.actionLabel }}

              </span>

              <span v-if="idx === 0" class="text-[10px] text-gray-400">Step {{ idx + 1 }}</span>

              <span v-else class="text-[10px] text-gray-400">Step {{ idx + 1 }}</span>

            </div>



            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">

              <div><span class="text-gray-400">Person:</span> {{ entry.actorName }}</div>

              <div><span class="text-gray-400">Role:</span> {{ entry.actorRoleLabel }}</div>

              <div><span class="text-gray-400">Office:</span> {{ entry.office ?? "—" }}</div>

              <div><span class="text-gray-400">When:</span> {{ formatDate(entry.createdAt) }}</div>

            </div>



            <div v-if="entry.previousStatus || entry.newStatus" class="text-xs text-gray-600">

              <span class="text-gray-400">Status:</span>

              {{ entry.previousStatus ?? "—" }} → {{ entry.newStatus ?? "—" }}

            </div>



            <p v-if="entry.notes" class="text-xs text-gray-700">

              <span class="text-gray-400">Notes:</span> {{ entry.notes }}

            </p>



            <div

              v-if="isCancelled(entry)"

              class="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800"

            >

              <span class="font-semibold">Cancellation reason:</span>

              {{ entry.notes ?? metadataField(entry, "reason", "cancel_reason") ?? "No reason recorded." }}

            </div>



            <div v-if="isUpdated(entry) && scheduleChanges(entry).length" class="space-y-1">

              <p class="text-xs font-semibold text-gray-700">Schedule changes</p>

              <div

                v-for="change in scheduleChanges(entry)"

                :key="change.label"

                class="text-xs text-gray-600 grid grid-cols-[auto_1fr_auto_1fr] gap-x-2 gap-y-0.5"

              >

                <span class="text-gray-400">{{ change.label }}:</span>

                <span>{{ change.from }}</span>

                <span class="text-gray-300">→</span>

                <span>{{ change.to }}</span>

              </div>

            </div>



            <details v-if="Object.keys(entry.metadata).length" class="text-[11px] text-gray-500">

              <summary class="cursor-pointer hover:text-gray-700">Metadata</summary>

              <pre class="mt-1 overflow-x-auto rounded bg-white p-2 text-[10px]">{{ JSON.stringify(entry.metadata, null, 2) }}</pre>

            </details>

          </div>

        </li>

      </ol>



      <PaginationControls

        :page="page"

        :page-size="pageSize"

        :total="total"

        :loading="loading"

        @update:page="page = $event"

        @update:page-size="(size) => { pageSize = size; page = 1; }"

      />

    </template>

  </div>

</template>


