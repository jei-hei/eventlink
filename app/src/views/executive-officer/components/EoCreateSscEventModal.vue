<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { CheckCircle, X } from "lucide-vue-next";
import { fetchCollegesWithOrganizations, fetchOrganizations, type OrganizationOption } from "@/services/organizationsDb";

export type EoCreateDirectPayload = {
  eventKind: "student" | "faculty";
  organizationId: string | null;
  organizationName: string;
  activity: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
};

const props = defineProps<{
  open: boolean;
}>();
const emit = defineEmits<{ "update:open": [v: boolean]; submit: [payload: EoCreateDirectPayload] }>();

const organizations = ref<OrganizationOption[]>([]);
const colleges = ref<Array<{ id: string; name: string }>>([]);

const form = reactive({
  eventKind: "student" as "student" | "faculty",
  organizationId: "",
  collegeName: "",
  activity: "",
  startDate: "",
  endDate: "",
  startTime: "08:00",
  endTime: "17:00",
});

const chosenOrganizationName = computed(() => {
  return organizations.value.find((o) => o.id === form.organizationId)?.name ?? "";
});

function resetForm() {
  form.eventKind = "student";
  form.organizationId = "";
  form.collegeName = "";
  form.activity = "";
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

onMounted(async () => {
  try {
    const [orgRows, collegeRows] = await Promise.all([fetchOrganizations(), fetchCollegesWithOrganizations()]);
    organizations.value = orgRows;
    colleges.value = collegeRows.map((c) => ({ id: c.id, name: c.name }));
  } catch {
    organizations.value = [];
    colleges.value = [];
  }
});

function close() {
  emit("update:open", false);
}

function parseTimeInput(value: string): string {
  const trimmed = value.trim();
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) return trimmed;
  return "08:00";
}

function onSubmit() {
  const isStudent = form.eventKind === "student";
  if (!form.activity.trim()) {
    window.alert("Please enter the activity name.");
    return;
  }
  if (!form.startDate) {
    window.alert("Please select start date.");
    return;
  }
  if (isStudent && !form.organizationId) {
    window.alert("Please select an organization for student event.");
    return;
  }
  if (!isStudent && !form.collegeName.trim()) {
    window.alert("Please select a college for faculty event.");
    return;
  }
  emit("submit", {
    eventKind: form.eventKind,
    organizationId: isStudent ? form.organizationId : null,
    organizationName: isStudent ? chosenOrganizationName.value : form.collegeName.trim(),
    activity: form.activity.trim(),
    startDate: form.startDate,
    endDate: form.endDate || form.startDate,
    startTime: parseTimeInput(form.startTime),
    endTime: parseTimeInput(form.endTime),
  });
  close();
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    @click.self="close"
  >
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
      <div class="bg-[#16A34A] text-white px-6 py-4 flex items-center justify-between">
        <h3 class="font-bold text-base">Add Event (Direct to Calendar)</h3>
        <button type="button" class="hover:bg-[#15803D] p-1.5 rounded-lg transition" @click="close">
          <X :size="18" />
        </button>
      </div>

      <div class="p-6 space-y-4">
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Event type *</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              :class="[
                'rounded-lg border px-3 py-2 text-sm font-semibold transition',
                form.eventKind === 'student'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
              ]"
              @click="form.eventKind = 'student'"
            >
              Student Event
            </button>
            <button
              type="button"
              :class="[
                'rounded-lg border px-3 py-2 text-sm font-semibold transition',
                form.eventKind === 'faculty'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
              ]"
              @click="form.eventKind = 'faculty'"
            >
              Faculty Event
            </button>
          </div>
        </div>

        <div v-if="form.eventKind === 'student'">
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Organization *</label>
          <select
            v-model="form.organizationId"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
          >
            <option value="" disabled>Select organization</option>
            <option v-for="org in organizations" :key="org.id" :value="org.id">{{ org.name }}</option>
          </select>
        </div>
        <div v-else>
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">College *</label>
          <select
            v-model="form.collegeName"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
          >
            <option value="" disabled>Select college</option>
            <option v-for="c in colleges" :key="c.id" :value="c.name">{{ c.name }}</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Activity *</label>
          <input
            v-model="form.activity"
            type="text"
            placeholder="Enter activity name"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
          />
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Start date *</label>
            <input
              v-model="form.startDate"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">End date</label>
            <input
              v-model="form.endDate"
              type="date"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
            />
          </div>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Start time *</label>
            <input
              v-model="form.startTime"
              type="time"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">End time *</label>
            <input
              v-model="form.endTime"
              type="time"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
            />
          </div>
        </div>
      </div>

      <div class="px-6 py-4 bg-gray-50 flex gap-3 justify-end border-t border-gray-200">
        <button
          type="button"
          class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-semibold transition"
          @click="close"
        >
          Cancel
        </button>
        <button
          type="button"
          class="px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-lg text-sm font-semibold transition flex items-center gap-2"
          @click="onSubmit"
        >
          <CheckCircle :size="15" />
          Add to calendar
        </button>
      </div>
    </div>
  </div>
</template>
