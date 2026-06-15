<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Save, X } from "lucide-vue-next";
import SdgCheckboxGroup from "@/components/SdgCheckboxGroup.vue";
import { parseSdgsFromStorage, formatSdgsForStorage } from "@/constants/sdgs";
import { useEventRequestsStore } from "@/stores/eventRequests";
import type { UpdateEventRequestInput } from "@/services/eventRequestsDb";
import type { EoEvent } from "../types";

const props = defineProps<{
  event: EoEvent | null;
}>();

const emit = defineEmits<{
  close: [];
  save: [id: string, input: UpdateEventRequestInput];
}>();

const store = useEventRequestsStore();

const form = ref({
  activity: "",
  startDate: "",
  endDate: "",
  startTime: "08:00",
  endTime: "17:00",
  venue: "",
  numberOfParticipants: 0,
  purpose: "",
});

const selectedSdgs = ref<number[]>([]);
const saving = ref(false);

const venueOptions = ["Gymnasium", "Devenecia", "Open Gymnasium", "Auditorium", "Other"];

function toTimeInput(value: string | undefined): string {
  if (!value) return "08:00";
  const parts = value.split(":");
  if (parts.length >= 2) return `${parts[0]!.padStart(2, "0")}:${parts[1]!.padStart(2, "0")}`;
  return value;
}

function resetForm() {
  const ev = props.event;
  if (!ev) return;

  const row = store.rows.find((r) => r.id === ev.id);
  form.value = {
    activity: ev.activity ?? ev.name,
    startDate: ev.startDate ?? "",
    endDate: ev.endDate ?? ev.startDate ?? "",
    startTime: toTimeInput(row?.start_time),
    endTime: toTimeInput(row?.end_time),
    venue: ev.venue ?? "",
    numberOfParticipants:
      typeof ev.participants === "number"
        ? ev.participants
        : parseInt(String(ev.participants ?? "0"), 10) || 0,
    purpose: ev.purpose ?? ev.description ?? "",
  };
  selectedSdgs.value = parseSdgsFromStorage(ev.sdgs ?? "");
}

watch(
  () => props.event,
  (ev) => {
    if (ev) resetForm();
  },
  { immediate: true },
);

const open = computed(() => !!props.event);

async function onSave() {
  if (!props.event) return;
  if (!form.value.activity.trim() || !form.value.startDate || !form.value.endDate || !form.value.venue) {
    window.alert("Please fill in activity, dates, and venue.");
    return;
  }
  if (form.value.endDate < form.value.startDate) {
    window.alert("End date cannot be before start date.");
    return;
  }

  saving.value = true;
  try {
    const input: UpdateEventRequestInput = {
      activity: form.value.activity,
      startDate: form.value.startDate,
      endDate: form.value.endDate,
      startTime: form.value.startTime,
      endTime: form.value.endTime,
      venue: form.value.venue,
      numberOfParticipants: form.value.numberOfParticipants,
      sdgs: formatSdgsForStorage(selectedSdgs.value),
      purpose: form.value.purpose,
    };
    emit("save", props.event.id, input);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div
    v-if="open && event"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    @click.self="emit('close')"
  >
    <div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-2xl">
      <div class="sticky top-0 flex items-center justify-between bg-[#16A34A] px-6 py-4 text-white">
        <h3 class="text-base font-bold">Edit scheduled event</h3>
        <button type="button" class="rounded-lg p-1.5 transition hover:bg-[#15803D]" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <form class="space-y-4 p-6" @submit.prevent="onSave">
        <div>
          <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Activity</label>
          <input
            v-model="form.activity"
            type="text"
            required
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
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

        <div class="grid grid-cols-2 gap-3">
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

        <div>
          <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Venue</label>
          <select
            v-model="form.venue"
            required
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option v-for="v in venueOptions" :key="v" :value="v">{{ v }}</option>
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

        <div>
          <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Purpose</label>
          <textarea
            v-model="form.purpose"
            rows="2"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
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
            :disabled="saving"
            class="inline-flex items-center gap-2 rounded-lg bg-[#16A34A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#15803D] disabled:opacity-60"
          >
            <Save :size="16" />
            {{ saving ? "Saving…" : "Save changes" }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
