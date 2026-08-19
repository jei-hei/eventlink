<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Package, Plus, Pencil } from "lucide-vue-next";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  createEquipment,
  fetchEquipmentForOffice,
  updateEquipment,
  type EquipmentRow,
} from "@/services/equipmentDb";
import type { ResourceOffice } from "@/types/resourceOffice";
import { resourceOfficeLabel } from "@/types/resourceOffice";

const props = defineProps<{
  office: ResourceOffice;
  title?: string;
}>();

const items = ref<EquipmentRow[]>([]);
const loading = ref(false);
const formOpen = ref(false);
const editingId = ref<string | null>(null);
const form = ref({
  name: "",
  description: "",
  quantity: 0,
  availability: "available",
  status: "active",
});

async function load() {
  if (!isSupabaseConfigured) return;
  loading.value = true;
  try {
    items.value = await fetchEquipmentForOffice(props.office);
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
    quantity: 0,
    availability: "available",
    status: "active",
  };
  formOpen.value = true;
}

function openEdit(row: EquipmentRow) {
  editingId.value = row.id;
  form.value = {
    name: row.name,
    description: row.description,
    quantity: row.quantity_available,
    availability: row.availability,
    status: row.status,
  };
  formOpen.value = true;
}

async function save() {
  if (!form.value.name.trim()) return;
  try {
    const payload = {
      name: form.value.name,
      description: form.value.description,
      quantityAvailable: form.value.quantity,
      responsibleOffice: props.office,
      availability: form.value.availability || "available",
      status: form.value.status,
      active: form.value.status !== "inactive",
    };
    if (editingId.value) {
      await updateEquipment(editingId.value, payload);
    } else {
      await createEquipment(payload);
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
        <h1 class="text-2xl font-bold text-gray-800">{{ title ?? "Equipment" }}</h1>
        <p class="mt-1 text-sm text-gray-500">
          Manage equipment for {{ resourceOfficeLabel(office) }}. These appear in event request forms.
        </p>
      </div>
      <button
        type="button"
        class="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        @click="openAdd"
      >
        <Plus :size="16" />
        Add equipment
      </button>
    </div>

    <div v-if="formOpen" class="dash-card mb-6 p-4">
      <h2 class="mb-3 text-sm font-bold uppercase tracking-wide text-gray-700">
        {{ editingId ? "Edit equipment" : "Add equipment" }}
      </h2>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block text-sm">
          <span class="mb-1 block text-xs font-semibold text-gray-500">Equipment name *</span>
          <input v-model="form.name" type="text" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block text-xs font-semibold text-gray-500">Quantity / available</span>
          <input v-model.number="form.quantity" type="number" min="0" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <label class="block text-sm sm:col-span-2">
          <span class="mb-1 block text-xs font-semibold text-gray-500">Description</span>
          <textarea v-model="form.description" rows="2" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block text-xs font-semibold text-gray-500">Responsible office</span>
          <input :value="resourceOfficeLabel(office)" type="text" disabled class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
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
            <th class="px-4 py-3">Equipment</th>
            <th class="px-4 py-3">Qty available</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id" class="border-t border-gray-100">
            <td class="px-4 py-3 text-sm font-medium text-gray-800">
              <div class="flex items-center gap-2">
                <Package :size="14" class="text-emerald-600" />
                {{ item.name }}
              </div>
              <p v-if="item.description" class="mt-0.5 text-xs text-gray-500">{{ item.description }}</p>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">{{ item.quantity_available }}</td>
            <td class="px-4 py-3 text-sm capitalize text-gray-600">{{ item.status }}</td>
            <td class="px-4 py-3">
              <button type="button" class="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700" @click="openEdit(item)">
                <Pencil :size="14" /> Edit
              </button>
            </td>
          </tr>
          <tr v-if="!items.length">
            <td colspan="4" class="px-4 py-10 text-center text-sm text-gray-400">No equipment yet. Add items to make them selectable in event requests.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
