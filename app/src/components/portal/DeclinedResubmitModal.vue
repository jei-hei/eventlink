<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Save, Upload, X } from "lucide-vue-next";
import SdgCheckboxGroup from "@/components/SdgCheckboxGroup.vue";
import { parseSdgsFromStorage, formatSdgsForStorage } from "@/constants/sdgs";
import { fetchActiveVenues } from "@/services/venuesDb";
import { isPdfProposalFile } from "@/services/eventLetterStorage";
import type { UpdateEventRequestInput } from "@/services/eventRequestsDb";
import type { PortalEvent } from "@/types/portalEvent";

const props = defineProps<{
  event: PortalEvent | null;
  submitting?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  submit: [id: string, input: UpdateEventRequestInput];
}>();

const form = ref({
  activity: "",
  startDate: "",
  endDate: "",
  startTime: "08:00",
  endTime: "17:00",
  venue: "",
  numberOfParticipants: 1,
  purpose: "",
});
const selectedSdgs = ref<number[]>([]);
const venues = ref<string[]>([]);
const loadingVenues = ref(false);
const letterFile = ref<File | null>(null);
const letterError = ref("");

const open = computed(() => !!props.event);
const isRevision = computed(() =>
  String(props.event?.workflowStatus ?? "")
    .toLowerCase()
    .includes("revision"),
);

function toTimeInput(value: string | undefined): string {
  if (!value) return "08:00";
  const v = value.trim();
  if (/^\d{2}:\d{2}$/.test(v)) return v;
  const m = v.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return "08:00";
  let hh = Number(m[1] ?? 8);
  const mm = String(m[2] ?? "00").padStart(2, "0");
  const meridian = (m[3] ?? "").toUpperCase();
  if (meridian === "PM" && hh < 12) hh += 12;
  if (meridian === "AM" && hh === 12) hh = 0;
  return `${String(hh).padStart(2, "0")}:${mm}`;
}

function resetForm() {
  const ev = props.event;
  if (!ev) return;
  form.value = {
    activity: ev.activity ?? ev.name,
    startDate: ev.startDate ?? "",
    endDate: ev.endDate ?? ev.startDate ?? "",
    startTime: toTimeInput(ev.startTime),
    endTime: toTimeInput(ev.endTime),
    venue: ev.venue ?? "",
    numberOfParticipants:
      typeof ev.participants === "number"
        ? ev.participants
        : Math.max(1, parseInt(String(ev.participants ?? "1"), 10) || 1),
    purpose: ev.purpose ?? ev.description ?? "",
  };
  selectedSdgs.value = parseSdgsFromStorage(ev.sdgs ?? "");
  letterFile.value = null;
  letterError.value = "";
}

async function loadVenues() {
  loadingVenues.value = true;
  try {
    const rows = await fetchActiveVenues();
    venues.value = rows.map((v) => v.name).filter(Boolean);
    if (form.value.venue && !venues.value.includes(form.value.venue)) {
      venues.value = [form.value.venue, ...venues.value];
    }
  } catch {
    venues.value = form.value.venue ? [form.value.venue] : [];
  } finally {
    loadingVenues.value = false;
  }
}

watch(
  () => props.event,
  (ev) => {
    if (!ev) return;
    resetForm();
    void loadVenues();
  },
  { immediate: true },
);

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

function submitForm() {
  if (!props.event) return;
  if (!form.value.activity.trim() || !form.value.startDate || !form.value.endDate || !form.value.venue.trim()) {
    window.alert("Please complete activity, date, and venue.");
    return;
  }
  if (form.value.endDate < form.value.startDate) {
    window.alert("End date cannot be before start date.");
    return;
  }
  if (form.value.numberOfParticipants < 1) {
    window.alert("Participants must be at least 1.");
    return;
  }
  if (!selectedSdgs.value.length) {
    window.alert("Please select at least one SDG.");
    return;
  }
  emit("submit", props.event.id, {
    activity: form.value.activity.trim(),
    startDate: form.value.startDate,
    endDate: form.value.endDate,
    startTime: form.value.startTime,
    endTime: form.value.endTime,
    venue: form.value.venue.trim(),
    numberOfParticipants: Math.max(1, Math.floor(form.value.numberOfParticipants)),
    sdgs: formatSdgsForStorage(selectedSdgs.value),
    purpose: form.value.purpose.trim(),
    letterFile: letterFile.value,
  });
}
</script>

<template>
  <div
    v-if="open && event"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    @click.self="emit('close')"
  >
    <div class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
      <div class="sticky top-0 flex items-center justify-between bg-[#16A34A] px-6 py-4 text-white">
        <h3 class="text-base font-bold">
          {{ isRevision ? "Edit and resubmit after revision" : "Edit declined request and resend" }}
        </h3>
        <button type="button" class="rounded-lg p-1.5 transition hover:bg-[#15803D]" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <form class="space-y-4 p-6" @submit.prevent="submitForm">
        <div
          :class="[
            'rounded-lg border px-3 py-2 text-sm',
            isRevision ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-red-200 bg-red-50 text-red-800',
          ]"
        >
          <p class="font-semibold">{{ isRevision ? "Compliance comment" : "Decline reason" }}</p>
          <p class="mt-1 whitespace-pre-wrap">{{ event.declineReason || "No reason provided." }}</p>
        </div>

        <div>
          <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Activity</label>
          <input
            v-model="form.activity"
            type="text"
            required
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Start date</label>
            <input
              v-model="form.startDate"
              type="date"
              required
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">End date</label>
            <input
              v-model="form.endDate"
              type="date"
              required
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Start time</label>
            <input
              v-model="form.startTime"
              type="time"
              required
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">End time</label>
            <input
              v-model="form.endTime"
              type="time"
              required
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Venue</label>
            <select
              v-model="form.venue"
              required
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option v-if="loadingVenues" value="" disabled>Loading venues...</option>
              <option v-for="v in venues" :key="v" :value="v">{{ v }}</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Participants</label>
            <input
              v-model.number="form.numberOfParticipants"
              type="number"
              min="1"
              required
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Purpose</label>
          <textarea
            v-model="form.purpose"
            rows="2"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">
            Replace proposal PDF (optional)
          </label>
          <label
            class="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-sm text-gray-600 hover:border-emerald-400"
          >
            <Upload :size="16" />
            <span class="truncate">{{ letterFile?.name || "Upload revised PDF" }}</span>
            <input type="file" accept=".pdf,application/pdf" class="sr-only" @change="onLetterChange" />
          </label>
          <p v-if="letterError" class="mt-1 text-xs text-red-600">{{ letterError }}</p>
          <p class="mt-1 text-xs text-gray-500">Uploading a new PDF adds a version to document history.</p>
        </div>

        <SdgCheckboxGroup v-model="selectedSdgs" />

        <div class="flex justify-end gap-2 border-t border-gray-200 pt-4">
          <button
            type="button"
            class="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="submitting"
            class="inline-flex items-center gap-2 rounded-lg bg-[#16A34A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#15803D] disabled:opacity-60"
          >
            <Save :size="16" />
            {{ submitting ? "Resubmitting..." : "Save and resubmit" }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
