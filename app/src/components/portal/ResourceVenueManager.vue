<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { MapPin, Plus, Pencil, Search } from "lucide-vue-next";
import PaginationControls from "@/components/PaginationControls.vue";
import { usePaginatedQuery } from "@/composables/usePaginatedQuery";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  createVenue,
  fetchVenuesPage,
  updateVenue,
  type VenueRow,
} from "@/services/venuesDb";
import type { ResourceOffice } from "@/types/resourceOffice";
import { resourceOfficeLabel } from "@/types/resourceOffice";
import { emptyPage } from "@/types/pagination";
import { toUserFacingError } from "@/utils/userFacingError";

const props = defineProps<{
  office: ResourceOffice;
  title?: string;
}>();

const searchQuery = ref("");
const formOpen = ref(false);
const editingId = ref<string | null>(null);
const form = ref({
  name: "",
  description: "",
  location: "",
  capacity: 0,
  availability: "available",
  status: "active",
});

const {
  page,
  pageSize,
  loading,
  error,
  rows: venues,
  total,
  refresh,
  setPage,
  setPageSize,
} = usePaginatedQuery<VenueRow, { office: ResourceOffice }>({
  fetcher: (params) => {
    if (!isSupabaseConfigured) return Promise.resolve(emptyPage<VenueRow>());
    return fetchVenuesPage(params);
  },
  filters: computed(() => ({ office: props.office })),
  search: searchQuery,
  immediate: isSupabaseConfigured,
});

watch(
  () => props.office,
  () => refresh(),
);

function openAdd() {
  editingId.value = null;
  form.value = {
    name: "",
    description: "",
    location: "",
    capacity: 0,
    availability: "available",
    status: "active",
  };
  formOpen.value = true;
}

function openEdit(v: VenueRow) {
  editingId.value = v.id;
  form.value = {
    name: v.name,
    description: v.description,
    location: v.location,
    capacity: v.capacity ?? 0,
    availability: v.availability,
    status: v.status,
  };
  formOpen.value = true;
}

async function save() {
  if (!form.value.name.trim()) return;
  try {
    const payload = {
      name: form.value.name,
      description: form.value.description,
      location: form.value.location,
      capacity: form.value.capacity || null,
      responsibleOffice: props.office,
      availability: form.value.availability,
      status: form.value.status,
      active: form.value.status !== "inactive",
    };
    if (editingId.value) {
      await updateVenue(editingId.value, payload);
    } else {
      await createVenue(payload);
    }
    formOpen.value = false;
    await refresh();
  } catch (e) {
    window.alert(toUserFacingError(e, "Could not save venue."));
  }
}
</script>

<template>
  <div class="dash-page dash-page-fill">
    <div class="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">{{ title ?? "Venues" }}</h1>
        <p class="mt-1 text-sm text-gray-500">
          Manage venues for {{ resourceOfficeLabel(office) }}. These appear in event request forms.
        </p>
      </div>
      <button
        type="button"
        class="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        @click="openAdd"
      >
        <Plus :size="16" />
        Add venue
      </button>
    </div>

    <div v-if="formOpen" class="dash-card shrink-0 p-4">
      <h2 class="mb-3 text-sm font-bold uppercase tracking-wide text-gray-700">
        {{ editingId ? "Edit venue" : "Add venue" }}
      </h2>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block text-sm">
          <span class="mb-1 block text-xs font-semibold text-gray-500">Venue name *</span>
          <input v-model="form.name" type="text" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block text-xs font-semibold text-gray-500">Location</span>
          <input v-model="form.location" type="text" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <label class="block text-sm sm:col-span-2">
          <span class="mb-1 block text-xs font-semibold text-gray-500">Description</span>
          <textarea v-model="form.description" rows="2" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block text-xs font-semibold text-gray-500">Capacity</span>
          <input v-model.number="form.capacity" type="number" min="0" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block text-xs font-semibold text-gray-500">Responsible office</span>
          <input :value="resourceOfficeLabel(office)" type="text" disabled class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block text-xs font-semibold text-gray-500">Availability</span>
          <select v-model="form.availability" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </label>
        <label class="block text-sm">
          <span class="mb-1 block text-xs font-semibold text-gray-500">Status</span>
          <select v-model="form.status" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </div>
      <div class="mt-4 flex gap-2 justify-end">
        <button type="button" class="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700" @click="formOpen = false">
          Cancel
        </button>
        <button type="button" class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white" @click="save">
          Save
        </button>
      </div>
    </div>

    <div class="dash-card shrink-0 p-4">
      <label class="block text-sm">
        <span class="mb-1 block text-xs font-semibold text-gray-500">Search venues</span>
        <div class="relative">
          <Search :size="16" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Name, location, description…"
            class="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
          />
        </div>
      </label>
    </div>

    <p v-if="error" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {{ error }}
    </p>

    <div class="dash-card dash-card-fill">
      <div class="min-h-0 flex-1 overflow-auto">
        <p v-if="loading" class="p-4 text-sm text-gray-500">Loading…</p>
        <table v-else class="w-full text-left">
          <thead class="sticky top-0 z-10 bg-gray-50 text-xs font-bold uppercase text-gray-600">
            <tr>
            <th class="px-4 py-3">Venue</th>
            <th class="px-4 py-3">Location</th>
            <th class="px-4 py-3">Capacity</th>
            <th class="px-4 py-3">Availability</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in venues" :key="v.id" class="border-t border-gray-100">
            <td class="px-4 py-3 text-sm font-medium text-gray-800">
              <div class="flex items-center gap-2">
                <MapPin :size="14" class="text-emerald-600" />
                {{ v.name }}
              </div>
              <p v-if="v.description" class="mt-0.5 text-xs text-gray-500">{{ v.description }}</p>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">{{ v.location || "—" }}</td>
            <td class="px-4 py-3 text-sm text-gray-600">{{ v.capacity ?? "—" }}</td>
            <td class="px-4 py-3 text-sm capitalize text-gray-600">{{ v.availability }}</td>
            <td class="px-4 py-3 text-sm capitalize text-gray-600">{{ v.status }}</td>
            <td class="px-4 py-3">
              <button type="button" class="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700" @click="openEdit(v)">
                <Pencil :size="14" /> Edit
              </button>
            </td>
          </tr>
          <tr v-if="!venues.length">
            <td colspan="6" class="px-4 py-10 text-center text-sm text-gray-400">No venues yet. Add one to make it selectable in event requests.</td>
          </tr>
        </tbody>
      </table>
      </div>
      <PaginationControls
        v-if="isSupabaseConfigured"
        :page="page"
        :page-size="pageSize"
        :total="total"
        :loading="loading"
        @update:page="setPage"
        @update:page-size="setPageSize"
      />
    </div>
  </div>
</template>
