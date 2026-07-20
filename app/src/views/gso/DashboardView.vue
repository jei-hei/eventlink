<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Calendar, CheckCircle, Package, XCircle } from "lucide-vue-next";
import type { GsoEvent } from "./types";
import { useGsoPortal } from "./portalContext";
import GsoEventDetailModal from "./components/GsoEventDetailModal.vue";
import ScheduledEventsCalendar from "@/components/ScheduledEventsCalendar.vue";
import { mapPortalEventsToCalendar } from "@/composables/mapPortalEventsToCalendar";
import { createEquipment, fetchActiveEquipment, updateEquipment } from "@/services/equipmentDb";
import { useEventsTableLoading } from "@/composables/useEventsTableLoading";
import PortalTableSkeleton from "@/components/portal/PortalTableSkeleton.vue";

const { events, scheduledEvents, handleApprove, handleReject, useDb } = useGsoPortal();
const eventsLoading = useEventsTableLoading();

const selectedEvent = ref<GsoEvent | null>(null);
const inventoryOpen = ref(false);
const addEquipmentOpen = ref(false);
const editingEquipmentId = ref<string | null>(null);

const gsoEvents = computed(() =>
  events.value.filter((e) => e.status === "Pending" && (e.venue || e.itemsEquipment)),
);

const pendingCount = computed(() => gsoEvents.value.length);

const calendarEvents = computed(() => mapPortalEventsToCalendar(scheduledEvents.value));

type InventoryStatus = "Available" | "Not available";
type InventoryItem = { id: string; name: string; available: number };

const defaultInventory: InventoryItem[] = [
  { id: "inv-auditorium", name: "Auditorium", available: 1 },
  { id: "inv-chairs", name: "Chairs", available: 150 },
  { id: "inv-tables", name: "Tables", available: 20 },
  { id: "inv-projector", name: "Projector", available: 0 },
  { id: "inv-sound-system", name: "Sound system", available: 1 },
  { id: "inv-microphone", name: "Microphone", available: 0 },
  { id: "inv-extension-cords", name: "Extension cords", available: 8 },
  { id: "inv-whiteboard", name: "Whiteboard", available: 3 },
  { id: "inv-fan", name: "Fan", available: 2 },
  { id: "inv-podium", name: "Podium", available: 1 },
];
const gsoInventory = ref<InventoryItem[]>([]);
const inventoryLoading = ref(false);
const inventorySaving = ref(false);
const inventoryError = ref<string | null>(null);

const newEquipmentName = ref("");
const newEquipmentAvailable = ref(0);
const inventorySearch = ref("");

const filteredInventory = computed(() => {
  const q = inventorySearch.value.trim().toLowerCase();
  if (!q) return gsoInventory.value;
  return gsoInventory.value.filter((item) => item.name.toLowerCase().includes(q));
});

function inventoryStatus(item: InventoryItem): InventoryStatus {
  return item.available > 0 ? "Available" : "Not available";
}

function inventoryStatusClass(status: InventoryStatus) {
  if (status === "Available") return "bg-emerald-100 text-emerald-800";
  return "bg-red-100 text-red-800";
}

function applyEquipmentConsumption(summary?: string) {
  if (!summary?.trim()) return;
  const parts = summary.split(",").map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const m = part.match(/^(.*)\(x(\d+)\)\s*$/i);
    const name = (m?.[1] ?? part).trim();
    const qty = Math.max(1, Number(m?.[2] ?? 1));
    const idx = gsoInventory.value.findIndex((i) => i.name.toLowerCase() === name.toLowerCase());
    if (idx < 0) continue;
    const row = gsoInventory.value[idx]!;
    const next = Math.max(0, row.available - qty);
    gsoInventory.value[idx] = { ...row, available: next };
  }
}

function approveWithInventory(event: GsoEvent) {
  if (!useDb.value) {
    applyEquipmentConsumption(event.itemsEquipment);
  }
  handleApprove(event.id);
  if (useDb.value) {
    window.setTimeout(() => {
      void loadInventory();
    }, 800);
  }
}

function resetAddEquipmentForm() {
  newEquipmentName.value = "";
  newEquipmentAvailable.value = 0;
  editingEquipmentId.value = null;
}

function openAddEquipment() {
  inventoryOpen.value = true;
  addEquipmentOpen.value = true;
  editingEquipmentId.value = null;
  resetAddEquipmentForm();
}

function startEditEquipment(item: InventoryItem) {
  inventoryOpen.value = true;
  addEquipmentOpen.value = true;
  editingEquipmentId.value = item.id;
  newEquipmentName.value = item.name;
  newEquipmentAvailable.value = item.available;
}

async function loadInventory() {
  if (!useDb.value) {
    gsoInventory.value = [...defaultInventory];
    inventoryError.value = null;
    return;
  }
  inventoryLoading.value = true;
  inventoryError.value = null;
  gsoInventory.value = [];
  try {
    const rows = await fetchActiveEquipment();
    gsoInventory.value = rows.map((row) => ({
      id: row.id,
      name: row.name,
      available: Math.max(0, Number(row.quantity_available ?? 0)),
    }));
  } catch (e) {
    inventoryError.value = e instanceof Error ? e.message : "Could not load inventory.";
  } finally {
    inventoryLoading.value = false;
  }
}

async function saveEquipment() {
  const name = newEquipmentName.value.trim();
  if (!name) return;
  const quantity = Math.max(0, Math.floor(newEquipmentAvailable.value || 0));
  inventoryError.value = null;

  inventorySaving.value = true;
  try {
    if (useDb.value) {
      if (editingEquipmentId.value) {
        const row = await updateEquipment(editingEquipmentId.value, {
          name,
          quantityAvailable: quantity,
        });
        gsoInventory.value = gsoInventory.value.map((item) =>
          item.id === row.id
            ? { id: row.id, name: row.name, available: Math.max(0, Number(row.quantity_available ?? 0)) }
            : item,
        );
      } else {
        const row = await createEquipment({
          name,
          quantityAvailable: quantity,
        });
        gsoInventory.value = [
          { id: row.id, name: row.name, available: Math.max(0, Number(row.quantity_available ?? 0)) },
          ...gsoInventory.value,
        ];
      }
    } else if (editingEquipmentId.value) {
      gsoInventory.value = gsoInventory.value.map((item) =>
        item.id === editingEquipmentId.value
          ? {
              ...item,
              name,
              available: quantity,
            }
          : item,
      );
    } else {
      const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const id = `inv-${base || "item"}-${Date.now()}`;
      gsoInventory.value.unshift({
        id,
        name,
        available: quantity,
      });
    }
    addEquipmentOpen.value = false;
    resetAddEquipmentForm();
  } catch (e) {
    inventoryError.value = e instanceof Error ? e.message : "Could not save equipment.";
  } finally {
    inventorySaving.value = false;
  }
}

function onModalApprove() {
  if (!selectedEvent.value) return;
  approveWithInventory(selectedEvent.value);
  selectedEvent.value = null;
}

function onModalReject() {
  if (!selectedEvent.value) return;
  handleReject(selectedEvent.value.id);
  selectedEvent.value = null;
}

onMounted(() => {
  void loadInventory();
});
</script>

<template>
  <div class="dash-page">
    <div class="dash-split lg:flex-col xl:flex-row xl:items-start">
      <div class="flex min-h-0 min-w-0 flex-1 flex-col gap-3 sm:gap-4 xl:flex-[0_0_68%]">
        <div class="dash-card flex min-h-[min(220px,45vh)] flex-1 flex-col">
          <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2.5 sm:px-4">
            <Calendar :size="18" class="text-emerald-600" />
            <h2 class="text-xs font-bold uppercase tracking-wide text-slate-800 sm:text-sm">
              Events requiring venue / equipment
            </h2>
            <span
              v-if="pendingCount > 0"
              class="rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-2 py-0.5 text-xs font-bold text-white shadow-sm"
            >
              {{ pendingCount }}
            </span>
          </div>

          <div class="min-h-0 flex-1 overflow-auto">
            <table class="w-full min-w-[36rem] text-left sm:min-w-0">
              <thead class="sticky top-0 z-10 bg-slate-50">
                <tr>
                  <th
                    class="border-r border-slate-200 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600"
                  >
                    Activity
                  </th>
                  <th
                    class="border-r border-slate-200 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600"
                  >
                    Organization
                  </th>
                  <th
                    class="border-r border-slate-200 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600"
                  >
                    Date / time
                  </th>
                  <th
                    class="border-r border-slate-200 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600"
                  >
                    Venue
                  </th>
                  <th
                    class="border-r border-slate-200 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-600"
                  >
                    Equipment
                  </th>
                  <th
                    class="sticky right-0 z-20 min-w-[8.5rem] bg-slate-50 px-3 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-slate-600 shadow-[-6px_0_10px_-6px_rgba(15,23,42,0.2)]"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                <PortalTableSkeleton v-if="eventsLoading" :rows="5" :columns="6" />
                <tr
                  v-else
                  v-for="event in gsoEvents"
                  :key="event.id"
                  :class="[
                    'cursor-pointer border-b border-slate-100 transition hover:bg-emerald-50/50',
                    event.status === 'Conflict' ? 'bg-amber-50/80' : '',
                  ]"
                  @click="selectedEvent = event"
                >
                  <td class="border-r border-slate-100 px-3 py-2.5 text-sm font-medium text-slate-800">{{ event.name }}</td>
                  <td class="border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600">{{ event.organization }}</td>
                  <td class="border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600">
                    <div>{{ event.date }}</div>
                    <div v-if="event.startTime && event.endTime" class="text-xs text-slate-500">
                      {{ event.startTime }} – {{ event.endTime }}
                    </div>
                  </td>
                  <td class="border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600">{{ event.venue }}</td>
                  <td class="max-w-[14rem] truncate border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600" :title="event.itemsEquipment || 'N/A'">
                    {{ event.itemsEquipment || "N/A" }}
                  </td>
                  <td
                    class="sticky right-0 z-10 bg-white/95 px-2 py-2 text-center shadow-[-6px_0_10px_-6px_rgba(15,23,42,0.15)] sm:px-3"
                    @click.stop
                  >
                    <div class="flex flex-col items-stretch gap-1.5 sm:flex-row sm:flex-wrap sm:justify-center">
                      <button
                        type="button"
                        class="inline-flex items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-700 px-2 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:from-emerald-500 hover:to-teal-600 sm:text-xs"
                        @click="approveWithInventory(event)"
                      >
                        <CheckCircle :size="12" />
                        Approve
                      </button>
                      <button
                        type="button"
                        class="inline-flex items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-red-600 to-red-700 px-2 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:from-red-500 hover:to-red-600 sm:text-xs"
                        @click="handleReject(event.id)"
                      >
                        <XCircle :size="12" />
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-else-if="gsoEvents.length === 0">
                  <td colspan="6" class="py-12 text-center text-sm text-slate-400">No events requiring venue or equipment</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="dash-card">
          <div class="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5 sm:px-4">
            <div class="flex items-center gap-2">
              <Package :size="18" class="text-emerald-600" />
              <h2 class="text-xs font-bold uppercase tracking-wide text-slate-800 sm:text-sm">GSO inventory</h2>
            </div>
            <div class="flex items-center gap-2">
              <input
                v-model.trim="inventorySearch"
                class="input-dash h-8 w-44 py-1 text-xs sm:w-56"
                type="search"
                placeholder="Search equipment"
              />
              <button
                type="button"
                class="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                @click="openAddEquipment"
              >
                Add equipment
              </button>
              <button
                type="button"
                class="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                @click="inventoryOpen = !inventoryOpen"
              >
                {{ inventoryOpen ? "Hide" : "Show" }}
              </button>
            </div>
          </div>
          <p v-if="inventoryError" class="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:px-4">
            {{ inventoryError }}
          </p>
          <div v-if="addEquipmentOpen" class="border-b border-slate-200 px-3 py-3 sm:px-4">
            <div class="grid gap-2 sm:grid-cols-2">
              <input v-model.trim="newEquipmentName" class="input-dash" placeholder="Equipment name" />
              <input
                v-model.number="newEquipmentAvailable"
                class="input-dash"
                type="number"
                min="0"
                placeholder="Quantity"
              />
            </div>
            <div class="mt-2 flex justify-end gap-2">
              <button
                type="button"
                class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                @click="
                  addEquipmentOpen = false;
                  resetAddEquipmentForm();
                "
              >
                Cancel
              </button>
              <button
                type="button"
                class="rounded-lg bg-gradient-to-r from-emerald-600 to-teal-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:from-emerald-500 hover:to-teal-600"
                :disabled="inventorySaving || !newEquipmentName.trim()"
                @click="saveEquipment"
              >
                {{ inventorySaving ? "Saving..." : editingEquipmentId ? "Save changes" : "Save equipment" }}
              </button>
            </div>
          </div>
          <div v-if="inventoryOpen" class="p-3 sm:p-4">
            <div v-if="inventoryLoading" class="py-6 text-center text-xs text-slate-500">Loading inventory...</div>
            <div class="space-y-2">
              <div
                v-for="item in filteredInventory"
                :key="item.id"
                class="flex items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-slate-50/50 p-3 transition hover:border-emerald-200/80 hover:bg-white"
              >
                <h3 class="text-sm font-medium text-slate-800">{{ item.name }}</h3>
                <div class="flex shrink-0 items-center gap-3">
                  <span class="text-sm text-slate-600">{{ item.available }} available</span>
                  <span
                    :class="['rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap', inventoryStatusClass(inventoryStatus(item))]"
                  >
                    {{ inventoryStatus(item) }}
                  </span>
                  <button
                    type="button"
                    class="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                    @click="startEditEquipment(item)"
                  >
                    Edit
                  </button>
                </div>
              </div>
              <p v-if="!filteredInventory.length" class="py-6 text-center text-xs text-slate-500">
                No equipment matched your search.
              </p>
            </div>
          </div>
          <p v-else class="px-4 py-3 text-xs text-slate-500">Inventory is hidden to keep focus on requests and calendar.</p>
        </div>
      </div>

      <div class="flex min-h-0 min-w-0 flex-col xl:flex-[0_0_32%] xl:self-start">
        <ScheduledEventsCalendar :events="calendarEvents" class="min-h-[420px] lg:min-h-[460px] xl:min-h-0" />
      </div>
    </div>

    <GsoEventDetailModal
      v-if="selectedEvent"
      :event="selectedEvent"
      @close="selectedEvent = null"
      @approve="onModalApprove"
      @reject="onModalReject"
    />
  </div>
</template>
