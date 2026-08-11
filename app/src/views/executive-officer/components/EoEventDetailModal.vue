<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { X } from "lucide-vue-next";
import EventLetterLink from "@/components/EventLetterLink.vue";
import type { EoEvent } from "../types";
import type { ResourceAssignmentInput, ResourceOffice } from "@/types/resourceOffice";
import {
  EQUIPMENT_OFFICES,
  VENUE_OFFICES,
  resourceOfficeLabel,
} from "@/types/resourceOffice";

const props = defineProps<{ event: EoEvent }>();
const emit = defineEmits<{
  close: [];
  approveAndForward: [id: string, assignments: ResourceAssignmentInput[]];
  reject: [id: string];
}>();

type DraftRow = {
  key: string;
  resourceKind: "venue" | "equipment";
  venueId: string | null;
  equipmentId: string | null;
  resourceName: string;
  quantity: number;
  assignedOffice: ResourceOffice | "";
};

const drafts = reactive<DraftRow[]>([]);

function buildDrafts(event: EoEvent): DraftRow[] {
  if (event.resourceAssignments?.length) {
    return event.resourceAssignments.map((a, idx) => ({
      key: a.id || `ra-${idx}`,
      resourceKind: a.resourceKind,
      venueId: a.venueId,
      equipmentId: a.equipmentId,
      resourceName: a.resourceName,
      quantity: a.quantity,
      assignedOffice: a.assignedOffice,
    }));
  }

  const rows: DraftRow[] = [];
  rows.push({
    key: `venue-${event.id}`,
    resourceKind: "venue",
    venueId: event.venueId ?? null,
    equipmentId: null,
    resourceName: event.venue || "Venue",
    quantity: 1,
    assignedOffice: "",
  });

  if (event.equipmentLines?.length) {
    event.equipmentLines.forEach((line, idx) => {
      rows.push({
        key: `eq-${event.id}-${idx}`,
        resourceKind: "equipment",
        venueId: null,
        equipmentId: line.equipmentId || null,
        resourceName: line.name,
        quantity: line.quantity,
        assignedOffice: "",
      });
    });
  } else {
    const eqText = event.itemsEquipment?.trim();
    if (eqText) {
      const parts = eqText.split(",").map((p) => p.trim()).filter(Boolean);
      parts.forEach((part, idx) => {
        const m = part.match(/^(.*)\(x(\d+)\)\s*$/i);
        const name = (m?.[1] ?? part).trim();
        const qty = Math.max(1, Number(m?.[2] ?? 1));
        rows.push({
          key: `eq-${event.id}-${idx}`,
          resourceKind: "equipment",
          venueId: null,
          equipmentId: null,
          resourceName: name,
          quantity: qty,
          assignedOffice: "",
        });
      });
    }
  }

  return rows;
}

watch(
  () => props.event.id,
  () => {
    drafts.splice(0, drafts.length, ...buildDrafts(props.event));
  },
  { immediate: true },
);

const needsAssignment = computed(() => !!props.event.awaitingResourceAssignment);

function officeOptions(kind: "venue" | "equipment") {
  return kind === "venue" ? VENUE_OFFICES : EQUIPMENT_OFFICES;
}

function statusClass(status: EoEvent["status"]) {
  if (status === "Conflict") return "bg-red-100 text-red-700";
  if (status === "Approved") return "bg-green-100 text-green-700";
  return "bg-yellow-100 text-yellow-700";
}

function onForward() {
  for (const d of drafts) {
    if (!d.assignedOffice) {
      window.alert(`Assign a responsible office for "${d.resourceName}".`);
      return;
    }
  }
  emit(
    "approveAndForward",
    props.event.id,
    drafts.map((d) => ({
      resourceKind: d.resourceKind,
      venueId: d.venueId,
      equipmentId: d.equipmentId,
      resourceName: d.resourceName,
      quantity: d.quantity,
      assignedOffice: d.assignedOffice as ResourceOffice,
    })),
  );
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="emit('close')">
    <div class="mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-2xl">
      <div class="sticky top-0 flex items-center justify-between bg-[#16A34A] px-6 py-4 text-white">
        <h3 class="text-base font-bold">Event Details</h3>
        <button type="button" class="rounded-lg p-1.5 transition hover:bg-[#15803D]" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="space-y-4 p-6">
        <div>
          <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Event Name</label>
          <p class="font-medium text-gray-800">{{ event.name }}</p>
        </div>
        <div>
          <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Organization</label>
          <p class="font-medium text-gray-800">{{ event.organization }}</p>
        </div>
        <div>
          <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Date</label>
          <p class="font-medium text-gray-800">{{ event.date }}</p>
        </div>
        <div>
          <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Venue</label>
          <p class="font-medium text-gray-800">{{ event.venue }}</p>
        </div>
        <div>
          <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Equipment</label>
          <p class="font-medium text-gray-800">{{ event.itemsEquipment || "—" }}</p>
        </div>
        <EventLetterLink v-if="event.letterPath" :letter-path="event.letterPath" />
        <div>
          <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Status</label>
          <span :class="['inline-block rounded-full px-2.5 py-1 text-xs font-semibold', statusClass(event.status)]">
            {{ event.workflowStatus || event.status }}
          </span>
        </div>

        <div v-if="needsAssignment" class="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
          <h4 class="mb-3 text-sm font-bold uppercase tracking-wide text-emerald-900">Resource Assignment</h4>
          <p class="mb-3 text-xs text-emerald-800">
            Assign each requested resource to a responsible office. Offices only receive what you assign.
          </p>
          <div v-for="d in drafts" :key="d.key" class="mb-3 rounded-lg border border-white bg-white p-3 last:mb-0">
            <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="text-sm font-semibold text-gray-800">{{ d.resourceName }}</p>
                <p class="text-xs text-gray-500">
                  Type: {{ d.resourceKind === "venue" ? "Venue" : "Equipment" }}
                  <span v-if="d.resourceKind === 'equipment'"> · Qty: {{ d.quantity }}</span>
                </p>
              </div>
            </div>
            <label class="block text-xs font-semibold text-gray-500">
              Responsible Office *
              <select
                v-model="d.assignedOffice"
                class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800"
              >
                <option value="" disabled>Select office…</option>
                <option v-for="o in officeOptions(d.resourceKind)" :key="o" :value="o">
                  {{ resourceOfficeLabel(o) }}
                </option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div class="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4">
        <button
          type="button"
          class="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-300"
          @click="emit('close')"
        >
          Close
        </button>
        <button
          type="button"
          class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          @click="emit('reject', event.id)"
        >
          Decline
        </button>
        <button
          v-if="needsAssignment"
          type="button"
          class="rounded-lg bg-[#16A34A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#15803D]"
          @click="onForward"
        >
          Approve &amp; Forward
        </button>
      </div>
    </div>
  </div>
</template>
