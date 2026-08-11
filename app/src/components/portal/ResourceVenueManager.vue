<script setup lang="ts">
import { onMounted, ref } from "vue";
import { MapPin, Plus, Pencil } from "lucide-vue-next";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  createVenue,
  fetchVenuesForOffice,
  updateVenue,
  type VenueRow,
} from "@/services/venuesDb";
import type { ResourceOffice } from "@/types/resourceOffice";
import { resourceOfficeLabel } from "@/types/resourceOffice";

const props = defineProps<{
  office: ResourceOffice;
  title?: string;
}>();

const venues = ref<VenueRow[]>([]);
const loading = ref(false);
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

async function load() {
  if (!isSupabaseConfigured) return;
  loading.value = true;
  try {
    venues.value = await fetchVenuesForOffice(props.office);
  } finally {
    loading.value = false;
  }
}

onMounted(() => void load());

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
    await load();
  } catch (e) {
    window.alert(e instanceof Error ? e.message : String(e));
  }
}
</script>

<template>
  <div class="dash-page">
    <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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

    <div v-if="formOpen" class="dash-card mb-6 p-4">
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

    <div class="dash-card overflow-hidden">
      <p v-if="loading" class="p-4 text-sm text-gray-500">Loading…</p>
      <table v-else class="w-full text-left">
        <thead class="bg-gray-50 text-xs font-bold uppercase text-gray-600">
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
  </div>
</template>
