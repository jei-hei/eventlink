<script setup lang="ts">
import { computed, ref } from "vue";
import { Download, FileSpreadsheet, Package, Plus, Pencil, Search, Upload } from "lucide-vue-next";
import PaginationControls from "@/components/PaginationControls.vue";
import StatusBadge from "@/components/portal/StatusBadge.vue";
import { usePaginatedQuery } from "@/composables/usePaginatedQuery";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  createEquipment,
  fetchAllEquipmentCatalog,
  fetchEquipmentPage,
  updateEquipment,
  type EquipmentRow,
} from "@/services/equipmentDb";
import {
  downloadEquipmentData,
  downloadEquipmentTemplate,
  EQUIPMENT_IMPORT_MAX_BYTES,
  EQUIPMENT_IMPORT_MAX_ROWS,
  equipmentImportHasBlockers,
  parseEquipmentCsv,
  parseEquipmentXlsx,
  validateEquipmentImportRows,
  type EquipmentImportPreviewRow,
} from "@/services/equipmentImportParser";
import { emptyPage } from "@/types/pagination";
import { toUserFacingError } from "@/utils/userFacingError";
import { useUiStore } from "@/stores/ui";

defineProps<{
  title?: string;
  /** Offices view their list only; Admin adds, edits, and imports (enforced by equipment RLS). */
  readonly?: boolean;
}>();

const ui = useUiStore();
const searchQuery = ref("");
const formOpen = ref(false);
const editingId = ref<string | null>(null);
const form = ref({
  name: "",
  description: "",
  quantity: 0,
  availability: "available",
  status: "active",
});

const fileInput = ref<HTMLInputElement | null>(null);
const parsing = ref(false);
const importing = ref(false);
const exporting = ref(false);
const previewRows = ref<EquipmentImportPreviewRow[]>([]);
const lastImportSummary = ref<string | null>(null);

const previewBlockers = computed(() => equipmentImportHasBlockers(previewRows.value));
const previewInvalidCount = computed(() => previewRows.value.filter((r) => r.statusLabel === "Invalid").length);
const previewValidCount = computed(() => previewRows.value.filter((r) => r.statusLabel === "Valid").length);

const {
  page,
  pageSize,
  loading,
  error,
  rows: items,
  total,
  refresh,
  setPage,
  setPageSize,
} = usePaginatedQuery<EquipmentRow>({
  fetcher: (params) => {
    if (!isSupabaseConfigured) return Promise.resolve(emptyPage<EquipmentRow>());
    return fetchEquipmentPage(params);
  },
  search: searchQuery,
  immediate: isSupabaseConfigured,
});

function statusTone(status: EquipmentImportPreviewRow["statusLabel"]) {
  if (status === "Valid") return "success" as const;
  if (status === "Duplicate") return "info" as const;
  if (status === "Warning") return "warning" as const;
  return "danger" as const;
}

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
    await refresh();
  } catch (e) {
    window.alert(toUserFacingError(e, "Could not save equipment."));
  }
}

function triggerUpload() {
  fileInput.value?.click();
}

function downloadTemplate() {
  downloadEquipmentTemplate();
  ui.pushToast(
    "Template downloaded",
    "Replace the EXAMPLE row before uploading. Example rows are not imported.",
    "info",
  );
}

async function downloadCurrentData() {
  exporting.value = true;
  try {
    const rows = isSupabaseConfigured ? await fetchAllEquipmentCatalog() : items.value;
    downloadEquipmentData(rows);
    ui.pushToast("Downloaded", `${rows.length} equipment row(s) exported.`, "success");
  } catch (e) {
    ui.pushToast("Download failed", toUserFacingError(e, "Could not export equipment."), "error");
  } finally {
    exporting.value = false;
  }
}

async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  lastImportSummary.value = null;
  previewRows.value = [];
  if (file.size > EQUIPMENT_IMPORT_MAX_BYTES) {
    ui.pushToast("File too large", "Use a CSV or XLSX under 1 MB.", "error");
    return;
  }

  parsing.value = true;
  try {
    const name = file.name.toLowerCase();
    let rows;
    if (name.endsWith(".csv")) {
      rows = parseEquipmentCsv(await file.text());
    } else if (name.endsWith(".xlsx")) {
      rows = await parseEquipmentXlsx(await file.arrayBuffer());
    } else if (name.endsWith(".xls")) {
      ui.pushToast("Legacy XLS is not supported", "Save as XLSX or CSV, then upload again.", "error");
      return;
    } else {
      ui.pushToast("Unsupported file", "Use CSV or XLSX.", "error");
      return;
    }
    if (rows.length > EQUIPMENT_IMPORT_MAX_ROWS) {
      ui.pushToast("Too many rows", `Import at most ${EQUIPMENT_IMPORT_MAX_ROWS} equipment rows at a time.`, "error");
      return;
    }
    const existing = isSupabaseConfigured
      ? (await fetchAllEquipmentCatalog()).map((r) => r.name)
      : items.value.map((r) => r.name);
    previewRows.value = validateEquipmentImportRows(rows, existing);
    ui.pushToast(
      "Import preview ready",
      `${previewValidCount.value} new row(s) can be saved. Confirm import to write them.`,
      "success",
    );
  } catch (err) {
    ui.pushToast("Could not read file", toUserFacingError(err, "Use the downloadable template and try again."), "error");
  } finally {
    parsing.value = false;
  }
}

async function confirmImport() {
  if (previewBlockers.value) return;
  const toCreate = previewRows.value.filter((r) => r.statusLabel === "Valid");
  if (!toCreate.length) return;
  importing.value = true;
  let created = 0;
  try {
    for (const row of toCreate) {
      await createEquipment({
        name: row.name,
        description: row.description,
        quantityAvailable: row.quantity,
        availability: row.availability,
        status: row.status,
        active: row.status !== "inactive",
      });
      created += 1;
    }
    lastImportSummary.value = `Imported ${created} equipment item(s) into the shared catalog.`;
    previewRows.value = [];
    ui.pushToast("Import complete", lastImportSummary.value, "success");
    await refresh();
  } catch (e) {
    ui.pushToast(
      "Import stopped",
      `Saved ${created} row(s), then failed: ${toUserFacingError(e, "Could not save equipment.")}`,
      "error",
    );
    await refresh();
  } finally {
    importing.value = false;
  }
}
</script>

<template>
  <div class="dash-page dash-page-fill">
    <div class="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">{{ title ?? "Equipment" }}</h1>
        <p v-if="readonly" class="mt-1 text-sm text-gray-500">
          Shared equipment catalog for all offices. Only Admin can add, edit, or import equipment.
        </p>
        <p v-else class="mt-1 text-sm text-gray-500">
          One shared catalog for all offices. Items appear in event request forms, and EO assigns them to any office.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <input
          v-if="!readonly"
          ref="fileInput"
          type="file"
          accept=".csv,.xlsx,.xls"
          class="sr-only"
          @change="onImportFile"
        />
        <button
          v-if="!readonly"
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          @click="downloadTemplate"
        >
          <Download :size="16" />
          Download template
        </button>
        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          :disabled="exporting"
          @click="downloadCurrentData"
        >
          <Download :size="16" />
          {{ exporting ? "Exporting…" : "Download data" }}
        </button>
        <button
          v-if="!readonly"
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          :disabled="parsing || importing"
          @click="triggerUpload"
        >
          <Upload :size="16" />
          {{ parsing ? "Reading…" : "Upload file" }}
        </button>
        <button
          v-if="!readonly"
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          @click="openAdd"
        >
          <Plus :size="16" />
          Add equipment
        </button>
      </div>
    </div>

    <div v-if="!readonly" class="dash-card shrink-0 p-4">
      <h2 class="text-sm font-bold uppercase tracking-wide text-gray-700">Import equipment</h2>
      <p class="mt-1 text-sm text-gray-500">
        Download the template or current data, then upload a CSV or XLSX. Example rows and names that already exist are skipped. Nothing is saved until you confirm.
      </p>
      <div v-if="previewRows.length" class="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="previewBlockers || importing || parsing"
          @click="confirmImport"
        >
          <FileSpreadsheet :size="16" />
          {{ importing ? "Importing…" : `Confirm import (${previewValidCount})` }}
        </button>
        <p v-if="previewInvalidCount" class="text-sm font-medium text-red-700">
          {{ previewInvalidCount }} invalid row(s). Fix the file before confirming.
        </p>
      </div>
      <p v-if="lastImportSummary" class="mt-2 text-sm text-slate-700">{{ lastImportSummary }}</p>
      <div v-if="previewRows.length" class="mt-3 overflow-x-auto">
        <table class="min-w-[640px] w-full text-left text-sm">
          <thead>
            <tr class="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
              <th class="py-2 pr-3">Row</th>
              <th class="py-2 pr-3">Name</th>
              <th class="py-2 pr-3">Qty</th>
              <th class="py-2 pr-3">Status</th>
              <th class="py-2">Message</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in previewRows" :key="`${row.row}-${row.name}`" class="border-b border-gray-100">
              <td class="py-2 pr-3 font-mono text-xs">{{ row.row }}</td>
              <td class="py-2 pr-3">{{ row.name || "—" }}</td>
              <td class="py-2 pr-3">{{ Number.isFinite(row.quantity) ? row.quantity : "—" }}</td>
              <td class="py-2 pr-3">
                <StatusBadge :label="row.statusLabel" :tone="statusTone(row.statusLabel)" />
              </td>
              <td class="py-2 text-xs text-gray-600">{{ row.message }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="formOpen && !readonly" class="dash-card shrink-0 p-4">
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
        <span class="mb-1 block text-xs font-semibold text-gray-500">Search equipment</span>
        <div class="relative">
          <Search :size="16" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Name, description…"
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
              <th class="px-4 py-3">Equipment</th>
              <th class="px-4 py-3">Qty available</th>
              <th class="px-4 py-3">Status</th>
              <th v-if="!readonly" class="px-4 py-3">Actions</th>
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
              <td v-if="!readonly" class="px-4 py-3">
                <button type="button" class="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700" @click="openEdit(item)">
                  <Pencil :size="14" /> Edit
                </button>
              </td>
            </tr>
            <tr v-if="!items.length">
              <td :colspan="readonly ? 3 : 4" class="px-4 py-10 text-center text-sm text-gray-400">
                {{ readonly ? "No equipment yet. Admin adds equipment to the shared catalog." : "No equipment yet. Add items to make them selectable in event requests." }}
              </td>
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

