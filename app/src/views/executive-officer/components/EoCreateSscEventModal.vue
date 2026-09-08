<script setup lang="ts">
import { reactive, watch } from "vue";
import { CheckCircle, X } from "lucide-vue-next";

export type EoCreateDirectPayload = {
  eventKind: "faculty";
  organizationId: string | null;
  organizationName: string;
  activity: string;
  description: string;
  venue: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
};

const props = defineProps<{
  open: boolean;
}>();
const emit = defineEmits<{ "update:open": [v: boolean]; submit: [payload: EoCreateDirectPayload] }>();

const form = reactive({
  activity: "",
  description: "",
  venue: "",
  startDate: "",
  endDate: "",
  startTime: "08:00",
  endTime: "17:00",
});

function resetForm() {
  form.activity = "";
  form.description = "";
  form.venue = "";
  form.startDate = "";
  form.endDate = "";
  form.startTime = "08:00";
  form.endTime = "17:00";
}

watch(
  () => props.open,
  (o) => {
    if (o) resetForm();
  },
);

function close() {
  emit("update:open", false);
}

function parseTimeInput(value: string): string {
  const trimmed = value.trim();
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) return trimmed;
  return "08:00";
}

function onSubmit() {
  if (!form.activity.trim()) {
    window.alert("Please enter the activity name.");
    return;
  }
  if (!form.startDate) {
    window.alert("Please select start date.");
    return;
  }
  if (!window.confirm("Are you sure you want to add this event to the calendar?")) return;
  emit("submit", {
    eventKind: "faculty",
    organizationId: null,
    organizationName: "",
    activity: form.activity.trim(),
    description: form.description.trim(),
    venue: form.venue.trim() || "To be announced",
    startDate: form.startDate,
    endDate: form.endDate || form.startDate,
    startTime: parseTimeInput(form.startTime),
    endTime: parseTimeInput(form.endTime),
  });
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    @click.self="close"
  >
    <div class="mx-4 w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
      <div class="flex items-center justify-between bg-[#16A34A] px-6 py-4 text-white">
        <h3 class="text-base font-bold">Add Event (Direct to Calendar)</h3>
        <button type="button" class="rounded-lg p-1.5 transition hover:bg-[#15803D]" @click="close">
          <X :size="18" />
        </button>
      </div>

      <div class="space-y-4 p-6">
        <div>
          <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Activity Name *</label>
          <input
            v-model="form.activity"
            type="text"
            placeholder="Enter activity name"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
          />
        </div>
        <div>
          <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Description</label>
          <textarea
            v-model="form.description"
            rows="3"
            placeholder="Describe this event"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
          />
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Start date *</label>
            <input
              v-model="form.startDate"
              type="date"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">End date</label>
            <input
              v-model="form.endDate"
              type="date"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
            />
          </div>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Start time *</label>
            <input
              v-model="form.startTime"
              type="time"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">End time *</label>
            <input
              v-model="form.endTime"
              type="time"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
            />
          </div>
        </div>
        <div>
          <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Venue</label>
          <input
            v-model="form.venue"
            type="text"
            placeholder="Enter venue"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
          />
        </div>
      </div>

      <div class="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
        <button
          type="button"
          class="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-300"
          @click="close"
        >
          Cancel
        </button>
        <button
          type="button"
          class="flex items-center gap-2 rounded-lg bg-[#16A34A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#15803D]"
          @click="onSubmit"
        >
          <CheckCircle :size="15" />
          Add to calendar
        </button>
      </div>
    </div>
  </div>
</template>
