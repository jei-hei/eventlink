<script setup lang="ts">
import { onMounted, ref } from "vue";
import { MapPin, Plus } from "lucide-vue-next";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createVenue, fetchAllVenues, setVenueActive, type VenueRow } from "@/services/venuesDb";

const venues = ref<VenueRow[]>([]);
const newName = ref("");
const loading = ref(false);

async function load() {
  if (!isSupabaseConfigured) return;
  loading.value = true;
  try {
    venues.value = await fetchAllVenues();
  } finally {
    loading.value = false;
  }
}

onMounted(() => void load());

async function addVenue() {
  if (!newName.value.trim()) return;
  try {
    await createVenue(newName.value);
    newName.value = "";
    await load();
  } catch (e) {
    window.alert(e instanceof Error ? e.message : String(e));
  }
}

async function toggleActive(v: VenueRow) {
  try {
    await setVenueActive(v.id, !v.active);
    await load();
  } catch (e) {
    window.alert(e instanceof Error ? e.message : String(e));
  }
}
</script>

<template>
  <div class="dash-page">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-800">Venues</h1>
      <p class="mt-1 text-sm text-gray-500">
        Manage venues that appear when officers and SSC create event requests.
      </p>
    </div>

    <div class="dash-card mb-6 p-4">
      <h2 class="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-700">
        <MapPin :size="16" class="text-emerald-600" />
        Add venue
      </h2>
      <div class="flex flex-col gap-3 sm:flex-row">
        <input
          v-model="newName"
          type="text"
          placeholder="Venue name"
          class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          @click="addVenue"
        >
          <Plus :size="16" />
          Add
        </button>
      </div>
    </div>

    <div class="dash-card overflow-hidden">
      <p v-if="loading" class="p-4 text-sm text-gray-500">Loading…</p>
      <table v-else class="w-full text-left">
        <thead class="bg-gray-50 text-xs font-bold uppercase text-gray-600">
          <tr>
            <th class="px-4 py-3">Venue</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in venues" :key="v.id" class="border-t border-gray-100">
            <td class="px-4 py-3 font-medium text-gray-800">{{ v.name }}</td>
            <td class="px-4 py-3">
              <span
                :class="[
                  'rounded-full px-2 py-0.5 text-xs font-semibold',
                  v.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600',
                ]"
              >
                {{ v.active ? "Active" : "Inactive" }}
              </span>
            </td>
            <td class="px-4 py-3">
              <button
                type="button"
                class="text-sm font-semibold text-emerald-700 hover:underline"
                @click="toggleActive(v)"
              >
                {{ v.active ? "Deactivate" : "Activate" }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
