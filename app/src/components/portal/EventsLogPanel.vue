<script setup lang="ts">

import { computed, onMounted, ref, watch } from "vue";

import { ClipboardList, Filter, RefreshCw } from "lucide-vue-next";

import PaginationControls from "@/components/PaginationControls.vue";

import PortalEmptyState from "@/components/portal/PortalEmptyState.vue";

import PortalTable from "@/components/portal/PortalTable.vue";

import {

  EVENT_LOG_ACTION_OPTIONS,

  EVENT_LOG_OFFICE_OPTIONS,

  EVENT_LOG_STATUS_OPTIONS,

  appRoleToEventsLogScope,

  fetchEventsLog,

  type EventsLogEntry,

  type EventsLogFilters,

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



const entries = ref<EventsLogEntry[]>([]);

const loading = ref(false);

const error = ref<string | null>(null);

const page = ref(1);

const pageSize = ref(DEFAULT_PAGE_SIZE);

const total = ref(0);



const filters = ref<EventsLogFilters>({

  dateFrom: null,

  dateTo: null,

  organizationId: null,

  collegeId: null,

  status: null,

  action: null,

  venue: null,

  office: null,

});



const analyticsScope = computed(() => appRoleToEventsLogScope(props.role));



const organizationOptions = computed(() => {

  const map = new Map<string, string>();

  for (const e of entries.value) {

    if (e.organizationId) map.set(e.organizationId, e.organizationName);

  }

  return [...map.entries()].map(([id, name]) => ({ id, name }));

});



const collegeOptions = computed(() => {

  const map = new Map<string, string>();

  for (const e of entries.value) {

    if (e.collegeId) map.set(e.collegeId, e.collegeName);

  }

  return [...map.entries()].map(([id, name]) => ({ id, name }));

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



function statusChangeLabel(entry: EventsLogEntry): string {

  if (entry.previousStatus || entry.newStatus) {

    return [entry.previousStatus ?? "—", entry.newStatus ?? "—"].join(" → ");

  }

  return "—";

}



function clearFilters() {

  filters.value = {

    dateFrom: null,

    dateTo: null,

    organizationId: null,

    collegeId: null,

    status: null,

    action: null,

    venue: null,

    office: null,

  };

}



async function loadLog() {

  const scopeRole = analyticsScope.value;

  if (!scopeRole) {

    entries.value = [];

    total.value = 0;

    error.value = "Events log is not available for this role.";

    return;

  }



  loading.value = true;

  error.value = null;

  try {

    const result = await fetchEventsLog(

      filters.value,

      {

        role: scopeRole,

        collegeId: props.collegeId,

        organizationId: props.organizationId,

        userId: props.userId,

      },

      { page: page.value, pageSize: pageSize.value },

    );

    entries.value = result.rows;

    total.value = result.total;

    page.value = result.page;

    pageSize.value = result.pageSize;

  } catch (e) {

    error.value = toUserFacingError(e, "Could not load events log.");

    entries.value = [];

    total.value = 0;

  } finally {

    loading.value = false;

  }

}



onMounted(() => {

  void loadLog();

});



watch(

  () => [props.role, props.collegeId, props.organizationId, props.userId],

  () => {

    if (page.value !== 1) {

      page.value = 1;

    } else {

      void loadLog();

    }

  },

);



watch(filters, () => {

  if (page.value !== 1) {

    page.value = 1;

  } else {

    void loadLog();

  }

}, { deep: true });



watch([page, pageSize], () => {

  void loadLog();

});

</script>



<template>

  <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">

    <div class="flex flex-col sm:flex-row sm:items-start gap-3">

      <div class="flex items-center gap-2 min-w-0">

        <div class="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">

          <ClipboardList :size="16" class="text-emerald-700" />

        </div>

        <div>

          <h3 class="font-bold text-gray-800 text-sm">Events Log</h3>

          <p class="text-gray-400 text-xs">Chronological event actions in your scope</p>

        </div>

      </div>

      <button

        type="button"

        class="sm:ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50"

        :disabled="loading"

        @click="loadLog"

      >

        <RefreshCw :size="14" :class="{ 'animate-spin': loading }" />

        Refresh

      </button>

    </div>



    <p v-if="error" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">

      {{ error }}

    </p>



    <div class="rounded-lg border border-gray-100 bg-gray-50/60 p-3 space-y-3">

      <div class="flex items-center gap-2 text-xs font-semibold text-gray-600">

        <Filter :size="14" />

        Filters

      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">

        <label class="text-[11px] text-gray-500 space-y-1">

          <span>Date from</span>

          <input v-model="filters.dateFrom" type="date" class="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs" />

        </label>

        <label class="text-[11px] text-gray-500 space-y-1">

          <span>Date to</span>

          <input v-model="filters.dateTo" type="date" class="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs" />

        </label>

        <label class="text-[11px] text-gray-500 space-y-1">

          <span>Organization</span>

          <select v-model="filters.organizationId" class="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs">

            <option :value="null">All</option>

            <option v-for="o in organizationOptions" :key="o.id" :value="o.id">{{ o.name }}</option>

          </select>

        </label>

        <label class="text-[11px] text-gray-500 space-y-1">

          <span>College</span>

          <select v-model="filters.collegeId" class="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs">

            <option :value="null">All</option>

            <option v-for="c in collegeOptions" :key="c.id" :value="c.id">{{ c.name }}</option>

          </select>

        </label>

        <label class="text-[11px] text-gray-500 space-y-1">

          <span>Status</span>

          <select v-model="filters.status" class="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs">

            <option :value="null">All</option>

            <option v-for="s in EVENT_LOG_STATUS_OPTIONS" :key="s.value" :value="s.value">{{ s.label }}</option>

          </select>

        </label>

        <label class="text-[11px] text-gray-500 space-y-1">

          <span>Action</span>

          <select v-model="filters.action" class="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs">

            <option :value="null">All</option>

            <option v-for="a in EVENT_LOG_ACTION_OPTIONS" :key="a.value" :value="a.value">{{ a.label }}</option>

          </select>

        </label>

        <label class="text-[11px] text-gray-500 space-y-1">

          <span>Venue</span>

          <input

            v-model="filters.venue"

            type="text"

            placeholder="Search venue"

            class="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs"

          />

        </label>

        <label class="text-[11px] text-gray-500 space-y-1">

          <span>Responsible office</span>

          <select v-model="filters.office" class="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs">

            <option :value="null">All</option>

            <option v-for="o in EVENT_LOG_OFFICE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>

          </select>

        </label>

      </div>

      <button

        type="button"

        class="text-xs font-semibold text-gray-600 hover:text-emerald-700"

        @click="clearFilters"

      >

        Clear Filters

      </button>

    </div>



    <div v-if="loading" class="text-center text-xs text-gray-500 py-8">Loading events log…</div>



    <PortalEmptyState

      v-else-if="!entries.length"

      title="No log entries yet"

      description="Event actions in your scope will appear here as requests move through the workflow."

    />



    <template v-else>

      <PortalTable min-width-class="min-w-[960px]">

        <thead>

          <tr>

            <th>Event</th>

            <th>Org</th>

            <th>College</th>

            <th>Action</th>

            <th>Status change</th>

            <th>Actor</th>

            <th>Role</th>

            <th>Date</th>

            <th>Notes</th>

          </tr>

        </thead>

        <tbody>

          <tr v-for="entry in entries" :key="entry.id">

            <td class="font-medium text-gray-800 max-w-[160px] truncate" :title="entry.eventName">{{ entry.eventName }}</td>

            <td class="max-w-[120px] truncate" :title="entry.organizationName">{{ entry.organizationName }}</td>

            <td class="max-w-[120px] truncate" :title="entry.collegeName">{{ entry.collegeName }}</td>

            <td>

              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">

                {{ entry.actionLabel }}

              </span>

            </td>

            <td class="text-xs text-gray-600">{{ statusChangeLabel(entry) }}</td>

            <td>{{ entry.actorName }}</td>

            <td class="text-xs">{{ entry.actorRoleLabel }}</td>

            <td class="text-xs whitespace-nowrap">{{ formatDate(entry.createdAt) }}</td>

            <td class="text-xs text-gray-600 max-w-[180px] truncate" :title="entry.notes ?? ''">

              {{ entry.notes ?? "—" }}

            </td>

          </tr>

        </tbody>

      </PortalTable>



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


