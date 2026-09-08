<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { ClipboardList, Eye, Filter, RefreshCw } from "lucide-vue-next";
import PaginationControls from "@/components/PaginationControls.vue";
import PortalEmptyState from "@/components/portal/PortalEmptyState.vue";
import PortalTable from "@/components/portal/PortalTable.vue";
import EventTrailPanel from "@/components/portal/EventTrailPanel.vue";
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
import { useAuthStore } from "@/stores/auth";

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
const trailRequestId = ref<string | null>(null);

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
const auth = useAuthStore();
const canAccessEventLog = computed(() => auth.appRole === "eo" && analyticsScope.value === "eo");

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
  if (!canAccessEventLog.value) {
    entries.value = [];
    total.value = 0;
    error.value = "Event Log is only available to the Executive Officer.";
    return;
  }

  loading.value = true;
  error.value = null;
  try {
    const result = await fetchEventsLog(
      filters.value,
      {
        role: analyticsScope.value!,
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

function openTrail(entry: EventsLogEntry) {
  trailRequestId.value = entry.requestId;
}

onMounted(() => {
  void loadLog();
});

watch(
  () => [props.role, props.collegeId, props.organizationId, props.userId],
  () => {
    if (page.value !== 1) page.value = 1;
    else void loadLog();
  },
);

watch(
  filters,
  () => {
    if (page.value !== 1) page.value = 1;
    else void loadLog();
  },
  { deep: true },
);

watch([page, pageSize], () => {
  void loadLog();
});
</script>

<template>
  <div class="space-y-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div class="flex min-w-0 items-center gap-2">
        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
          <ClipboardList :size="16" class="text-emerald-700" />
        </div>
        <div>
          <h3 class="text-sm font-bold text-gray-800">Event Log</h3>
          <p class="text-xs text-gray-400">Chronological event actions. Use View to open the Event Trail.</p>
        </div>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50 sm:ml-auto"
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

    <div class="space-y-3 rounded-lg border border-gray-100 bg-gray-50/60 p-3">
      <div class="flex items-center gap-2 text-xs font-semibold text-gray-600">
        <Filter :size="14" />
        Filters
      </div>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label class="space-y-1 text-[11px] text-gray-500">
          <span>Date from</span>
          <input v-model="filters.dateFrom" type="date" class="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs" />
        </label>
        <label class="space-y-1 text-[11px] text-gray-500">
          <span>Date to</span>
          <input v-model="filters.dateTo" type="date" class="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs" />
        </label>
        <label class="space-y-1 text-[11px] text-gray-500">
          <span>Organization</span>
          <select v-model="filters.organizationId" class="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs">
            <option :value="null">All</option>
            <option v-for="o in organizationOptions" :key="o.id" :value="o.id">{{ o.name }}</option>
          </select>
        </label>
        <label class="space-y-1 text-[11px] text-gray-500">
          <span>College</span>
          <select v-model="filters.collegeId" class="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs">
            <option :value="null">All</option>
            <option v-for="c in collegeOptions" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>
        <label class="space-y-1 text-[11px] text-gray-500">
          <span>Status</span>
          <select v-model="filters.status" class="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs">
            <option :value="null">All</option>
            <option v-for="s in EVENT_LOG_STATUS_OPTIONS" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </label>
        <label class="space-y-1 text-[11px] text-gray-500">
          <span>Action</span>
          <select v-model="filters.action" class="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs">
            <option :value="null">All</option>
            <option v-for="a in EVENT_LOG_ACTION_OPTIONS" :key="a.value" :value="a.value">{{ a.label }}</option>
          </select>
        </label>
        <label class="space-y-1 text-[11px] text-gray-500">
          <span>Venue</span>
          <input
            v-model="filters.venue"
            type="text"
            placeholder="Search venue"
            class="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs"
          />
        </label>
        <label class="space-y-1 text-[11px] text-gray-500">
          <span>Responsible office</span>
          <select v-model="filters.office" class="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs">
            <option :value="null">All</option>
            <option v-for="o in EVENT_LOG_OFFICE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </label>
      </div>
      <button type="button" class="text-xs font-semibold text-gray-600 hover:text-emerald-700" @click="clearFilters">
        Clear Filters
      </button>
    </div>

    <div v-if="loading" class="py-8 text-center text-xs text-gray-500">Loading events log…</div>

    <PortalEmptyState
      v-else-if="!entries.length"
      title="No log entries yet"
      description="Event actions in your scope will appear here as requests move through the workflow."
    />

    <template v-else>
      <PortalTable min-width-class="min-w-[880px]">
        <thead>
          <tr>
            <th>Date</th>
            <th>Event</th>
            <th>Action</th>
            <th>User</th>
            <th>Role</th>
            <th>Notes</th>
            <th>View</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="entry in entries"
            :key="entry.id"
            class="cursor-pointer hover:bg-emerald-50/40"
            @click="openTrail(entry)"
          >
            <td class="whitespace-nowrap text-xs">{{ formatDate(entry.createdAt) }}</td>
            <td class="max-w-[160px] truncate font-medium text-gray-800" :title="entry.eventName">{{ entry.eventName }}</td>
            <td>
              <span class="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                {{ entry.actionLabel }}
              </span>
            </td>
            <td>{{ entry.actorName }}</td>
            <td class="text-xs">{{ entry.actorRoleLabel }}</td>
            <td class="max-w-[180px] truncate text-xs text-gray-600" :title="entry.notes ?? ''">
              {{ entry.notes ?? "—" }}
            </td>
            <td @click.stop>
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-md bg-[#16A34A] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#15803D]"
                @click="openTrail(entry)"
              >
                <Eye :size="12" />
                View
              </button>
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
        @update:page-size="
          (size) => {
            pageSize = size;
            page = 1;
          }
        "
      />
    </template>

    <EventTrailPanel
      :open="!!trailRequestId"
      :request-id="trailRequestId"
      :role="role"
      :college-id="collegeId"
      :organization-id="organizationId"
      :user-id="userId"
      @close="trailRequestId = null"
    />
  </div>
</template>
