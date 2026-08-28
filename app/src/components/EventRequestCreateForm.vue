<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { FileText, Upload, X } from "lucide-vue-next";
import { isSupabaseConfigured } from "@/lib/supabase";
import { isPdfProposalFile } from "@/services/eventLetterStorage";
import {
  fetchOrganizationsForSubmit,
  fetchSscOrganization,
  SSC_ORGANIZATION_NAME,
  type OrganizationOption,
} from "@/services/organizationsDb";
import { fetchActiveVenues, type VenueRow } from "@/services/venuesDb";
import { fetchActiveEquipment, type EquipmentRow } from "@/services/equipmentDb";
import { formatSdgsForStorage } from "@/constants/sdgs";
import SdgCheckboxGroup from "@/components/SdgCheckboxGroup.vue";
import { useAuthStore } from "@/stores/auth";
import type { DbRequestType } from "@/types/eventRequest";

export type EventRequestFormPayload = {
  organizationId: string | null;
  organizationName: string;
  activity: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  venueId: string | null;
  numberOfParticipants: number;
  sdgs: string;
  needsGso: boolean;
  letterFile: File;
  equipment: { equipmentId: string; equipmentName: string; quantity: number }[];
};

const props = defineProps<{
  requestType: DbRequestType;
  workflowHint: string;
  submitting?: boolean;
}>();

const emit = defineEmits<{
  submit: [payload: EventRequestFormPayload];
  cancel: [];
}>();

const auth = useAuthStore();
const organizations = ref<OrganizationOption[]>([]);
const venues = ref<VenueRow[]>([]);
const equipment = ref<EquipmentRow[]>([]);
const orgLoading = ref(false);
const letterFile = ref<File | null>(null);
const letterError = ref("");
const equipmentRows = ref<Array<{ equipmentId: string; quantity: number }>>([]);

const form = reactive({
  organizationId: "",
  organizationName: "",
  activity: "",
  startDate: "",
  endDate: "",
  startTime: "08:00",
  endTime: "17:00",
  venueId: "",
  customVenue: "",
  venueMode: "select" as "select" | "custom",
  numberOfParticipants: 50,
  needsGso: false,
});

const isSscForm = computed(() => props.requestType === "ssc");
const isOfficerForm = computed(() => props.requestType === "student_officer");

const orgScopeHint = computed(() =>
  isSscForm.value
    ? ""
    : isOfficerForm.value
      ? "Organization is based on your registered account assignment."
      : "Only organizations in your college are listed.",
);

const selectedSdgs = ref<number[]>([]);

const useOrgSelect = computed(
  () => !isSscForm.value && !isOfficerForm.value && isSupabaseConfigured && organizations.value.length > 0,
);

const selectedOrgName = computed(() => {
  if (!form.organizationId) return form.organizationName;
  return organizations.value.find((o) => o.id === form.organizationId)?.name ?? form.organizationName;
});

const selectedVenueName = computed(() => {
  if (form.venueMode === "custom") return form.customVenue.trim();
  return venues.value.find((v) => v.id === form.venueId)?.name ?? "";
});

const resolvedVenueId = computed(() => {
  if (form.venueMode === "custom") return null;
  return form.venueId || null;
});

const selectedEquipmentIds = computed(() =>
  new Set(equipmentRows.value.map((r) => r.equipmentId).filter(Boolean)),
);

onMounted(async () => {
  if (isSscForm.value) {
    form.organizationName = SSC_ORGANIZATION_NAME;
  } else if (isOfficerForm.value && auth.organizationId) {
    form.organizationId = auth.organizationId;
  }

  if (!isSupabaseConfigured) {
    venues.value = [
      {
        id: "1",
        name: "Gymnasium",
        description: "",
        location: "",
        capacity: null,
        responsible_office: "gso",
        availability: "available",
        status: "active",
        active: true,
      },
      {
        id: "2",
        name: "Devenecia",
        description: "",
        location: "",
        capacity: null,
        responsible_office: "gso",
        availability: "available",
        status: "active",
        active: true,
      },
      {
        id: "3",
        name: "Open Gymnasium",
        description: "",
        location: "",
        capacity: null,
        responsible_office: "gso",
        availability: "available",
        status: "active",
        active: true,
      },
    ];
    equipment.value = [
      {
        id: "eq-1",
        name: "Chairs",
        description: "",
        quantity_available: 150,
        responsible_office: "gso",
        availability: "available",
        status: "active",
        active: true,
      },
      {
        id: "eq-2",
        name: "Tables",
        description: "",
        quantity_available: 20,
        responsible_office: "gso",
        availability: "available",
        status: "active",
        active: true,
      },
      {
        id: "eq-3",
        name: "Projector",
        description: "",
        quantity_available: 1,
        responsible_office: "gso",
        availability: "available",
        status: "active",
        active: true,
      },
      {
        id: "eq-4",
        name: "Sound system",
        description: "",
        quantity_available: 1,
        responsible_office: "gso",
        availability: "available",
        status: "active",
        active: true,
      },
    ];
    form.venueId = "1";
    return;
  }
  orgLoading.value = true;
  try {
    if (isSscForm.value) {
      const ssc = await fetchSscOrganization();
      if (ssc) {
        form.organizationId = ssc.id;
        form.organizationName = SSC_ORGANIZATION_NAME;
      }
    } else {
      const uid = auth.userId;
      if (uid) {
        organizations.value = await fetchOrganizationsForSubmit(uid, props.requestType);
      }
      if (isOfficerForm.value) {
        if (auth.organizationId) {
          form.organizationId = auth.organizationId;
          const own = organizations.value.find((o) => o.id === auth.organizationId);
          if (own?.name) form.organizationName = own.name;
        }
      } else if (organizations.value.length === 1) {
        form.organizationId = organizations.value[0]!.id;
      }
    }
    venues.value = await fetchActiveVenues();
    equipment.value = await fetchActiveEquipment();
    if (venues.value.length) {
      form.venueId = venues.value[0]!.id;
    }
  } catch {
    organizations.value = [];
    venues.value = [];
    equipment.value = [];
  } finally {
    orgLoading.value = false;
  }
});

function onLetterChange(ev: Event) {
  letterError.value = "";
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  if (!file) {
    letterFile.value = null;
    return;
  }
  if (!isPdfProposalFile(file)) {
    letterError.value = "Only PDF files (.pdf) are allowed.";
    letterFile.value = null;
    input.value = "";
    return;
  }
  letterFile.value = file;
}

function clearLetter() {
  letterFile.value = null;
  letterError.value = "";
}

function resetForm() {
  form.organizationId = isOfficerForm.value ? (auth.organizationId ?? "") : "";
  form.organizationName = isSscForm.value ? SSC_ORGANIZATION_NAME : "";
  form.activity = "";
  form.startDate = "";
  form.endDate = "";
  form.startTime = "08:00";
  form.endTime = "17:00";
  form.venueId = venues.value[0]?.id ?? "";
  form.customVenue = "";
  form.venueMode = "select";
  form.numberOfParticipants = 50;
  selectedSdgs.value = [];
  form.needsGso = false;
  letterFile.value = null;
  letterError.value = "";
  equipmentRows.value = [];
}

function parseTimeInput(value: string): string {
  const trimmed = value.trim();
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) return trimmed;
  return "08:00";
}

function addEquipmentRow() {
  equipmentRows.value.push({ equipmentId: "", quantity: 1 });
}

function removeEquipmentRow(idx: number) {
  equipmentRows.value.splice(idx, 1);
}

function handleSubmit() {
  const orgName = isSscForm.value ? SSC_ORGANIZATION_NAME : selectedOrgName.value.trim();
  const resolvedOrganizationId = isOfficerForm.value ? (auth.organizationId ?? form.organizationId) : form.organizationId;
  if (isSscForm.value && !form.organizationId && isSupabaseConfigured) {
    window.alert(
      "SSC organization is not set up in the database yet. Ask admin to run the SSC seed in supabase/seed/03_ssc_organization.sql.",
    );
    return;
  }
  if (useOrgSelect.value && !form.organizationId) {
    window.alert("Please select an organization.");
    return;
  }
  if (isOfficerForm.value && !resolvedOrganizationId) {
    window.alert("Your account has no assigned organization yet. Ask Admin to set your organization.");
    return;
  }
  if (!isSscForm.value && !useOrgSelect.value && !orgName) {
    window.alert("Please enter your organization.");
    return;
  }
  if (!form.activity.trim()) {
    window.alert("Please enter the activity name.");
    return;
  }
  if (!form.startDate) {
    window.alert("Please select the event start date.");
    return;
  }
  if (!letterFile.value) {
    window.alert("Please upload your PDF proposal (.pdf).");
    return;
  }
  if (!selectedVenueName.value) {
    window.alert(
      form.venueMode === "custom"
        ? "Please enter a venue name."
        : "Please select a venue or choose “Type a custom venue”.",
    );
    return;
  }
  if (form.venueMode === "select" && !form.venueId) {
    window.alert("Please select a venue.");
    return;
  }
  if (form.numberOfParticipants < 1) {
    window.alert("Number of participants must be at least 1.");
    return;
  }
  if (selectedSdgs.value.length === 0) {
    window.alert("Please select at least one SDG.");
    return;
  }

  const normalizedEquipment = equipmentRows.value
    .filter((r) => r.equipmentId)
    .map((r) => ({
      equipmentId: r.equipmentId,
      equipmentName: equipment.value.find((e) => e.id === r.equipmentId)?.name ?? "Equipment",
      quantity: Math.max(1, Math.floor(Number(r.quantity) || 1)),
    }));

  emit("submit", {
    organizationId: resolvedOrganizationId || null,
    organizationName: orgName,
    activity: form.activity.trim(),
    startDate: form.startDate,
    endDate: form.endDate || form.startDate,
    startTime: parseTimeInput(form.startTime),
    endTime: parseTimeInput(form.endTime),
    venue: selectedVenueName.value,
    venueId: resolvedVenueId.value,
    numberOfParticipants: form.numberOfParticipants,
    sdgs: formatSdgsForStorage(selectedSdgs.value),
    needsGso: form.needsGso,
    letterFile: letterFile.value,
    equipment: normalizedEquipment,
  });
}

defineExpose({ resetForm });
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">
        Upload PDF proposal *
      </label>
      <div
        class="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 transition hover:border-[#16A34A]/50"
      >
        <input
          id="event-letter-upload"
          type="file"
          accept=".pdf,application/pdf"
          class="sr-only"
          @change="onLetterChange"
        />
        <label
          for="event-letter-upload"
          class="flex cursor-pointer flex-col items-center gap-2 text-center sm:flex-row sm:text-left"
        >
          <div class="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Upload :size="20" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-gray-800">Choose PDF file</p>
            <p class="text-xs text-gray-500">Official proposal document from your organization</p>
          </div>
        </label>
        <div
          v-if="letterFile"
          class="mt-3 flex items-center justify-between gap-2 rounded-md border border-emerald-200 bg-white px-3 py-2"
        >
          <span class="flex min-w-0 items-center gap-2 text-sm text-gray-800">
            <FileText :size="16" class="shrink-0 text-emerald-600" />
            <span class="truncate">{{ letterFile.name }}</span>
          </span>
          <button type="button" class="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100" @click="clearLetter">
            <X :size="16" />
          </button>
        </div>
        <p v-if="letterError" class="mt-2 text-xs text-red-600">{{ letterError }}</p>
      </div>
    </div>

    <div>
      <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Organization *</label>
      <p v-if="orgScopeHint" class="mb-1.5 text-xs text-gray-500">{{ orgScopeHint }}</p>
      <div
        v-if="isSscForm"
        class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-900"
      >
        {{ SSC_ORGANIZATION_NAME }}
      </div>
      <select
        v-else-if="useOrgSelect"
        v-model="form.organizationId"
        :disabled="orgLoading"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
      >
        <option value="" disabled>{{ orgLoading ? "Loading…" : "Select organization" }}</option>
        <option v-for="org in organizations" :key="org.id" :value="org.id">{{ org.name }}</option>
      </select>
      <div
        v-else-if="isOfficerForm"
        class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-900"
      >
        {{ selectedOrgName || "No organization assigned" }}
      </div>
      <input
        v-else
        v-model="form.organizationName"
        type="text"
        placeholder="Organization name"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
      />
    </div>

    <div>
      <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Activity *</label>
      <input
        v-model="form.activity"
        type="text"
        placeholder="e.g. Sports Festival, Leadership Seminar"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
      />
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Start date *</label>
        <input
          v-model="form.startDate"
          type="date"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
        />
      </div>
      <div>
        <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">End date</label>
        <input
          v-model="form.endDate"
          type="date"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
        />
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Start time *</label>
        <input
          v-model="form.startTime"
          type="time"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
        />
      </div>
      <div>
        <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">End time *</label>
        <input
          v-model="form.endTime"
          type="time"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
        />
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="space-y-2">
        <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Requested Venue *</label>
        <div class="flex gap-2">
          <button
            type="button"
            :class="[
              'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition',
              form.venueMode === 'select'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
            ]"
            @click="form.venueMode = 'select'"
          >
            Choose existing
          </button>
          <button
            type="button"
            :class="[
              'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition',
              form.venueMode === 'custom'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
            ]"
            @click="form.venueMode = 'custom'"
          >
            Type custom
          </button>
        </div>
        <select
          v-if="form.venueMode === 'select'"
          v-model="form.venueId"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
        >
          <option value="" disabled>
            {{ venues.length ? "Select venue" : "No venues listed — use Type custom" }}
          </option>
          <option v-for="v in venues" :key="v.id" :value="v.id">{{ v.name }}</option>
        </select>
        <input
          v-else
          v-model="form.customVenue"
          type="text"
          placeholder="e.g. Barangay Covered Court"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
        />
        <p v-if="form.venueMode === 'custom'" class="text-xs text-slate-500">
          Custom venues are saved on this request only and are not added to the Venue database.
        </p>
      </div>
      <div>
        <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">
          No. of participants *
        </label>
        <input
          v-model.number="form.numberOfParticipants"
          type="number"
          min="1"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
        />
      </div>
    </div>

    <div class="space-y-2">
      <div class="flex items-center justify-between gap-2">
        <label class="block text-xs font-bold uppercase tracking-wider text-gray-500">Equipment (optional)</label>
        <button
          type="button"
          class="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
          @click="addEquipmentRow"
        >
          + Add equipment
        </button>
      </div>
      <div v-if="!equipment.length" class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        No active equipment in database yet. GSO/Admin can add equipment entries first.
      </div>
      <div v-for="(row, idx) in equipmentRows" :key="idx" class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr,140px,auto]">
        <select
          v-model="row.equipmentId"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
        >
          <option value="" disabled>Select equipment</option>
          <option
            v-for="eq in equipment"
            :key="eq.id"
            :value="eq.id"
            :disabled="selectedEquipmentIds.has(eq.id) && eq.id !== row.equipmentId"
          >
            {{ eq.name }} ({{ eq.quantity_available }} available)
          </option>
        </select>
        <input
          v-model.number="row.quantity"
          type="number"
          min="1"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
          placeholder="Quantity"
        />
        <button
          type="button"
          class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
          @click="removeEquipmentRow(idx)"
        >
          Remove
        </button>
      </div>
    </div>

    <div>
      <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">SDG/s *</label>
      <SdgCheckboxGroup v-model="selectedSdgs" />
    </div>

    <div class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <p class="text-xs font-bold text-blue-800">Approval workflow</p>
      <p class="mt-1 text-xs text-blue-700">{{ workflowHint }}</p>
    </div>

    <div class="flex justify-end gap-3 border-t border-gray-200 pt-4">
      <button
        type="button"
        class="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-300"
        :disabled="submitting"
        @click="emit('cancel')"
      >
        Cancel
      </button>
      <button
        type="button"
        class="flex items-center gap-2 rounded-lg bg-[#16A34A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#15803D] disabled:opacity-60"
        :disabled="submitting"
        @click="handleSubmit"
      >
        {{ submitting ? "Submitting…" : "Submit request" }}
      </button>
    </div>
  </div>
</template>
