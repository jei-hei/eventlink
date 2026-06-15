<script setup lang="ts">
import { ref, watch } from "vue";
import { X } from "lucide-vue-next";
import EventRequestCreateForm, {
  type EventRequestFormPayload,
} from "@/components/EventRequestCreateForm.vue";
import type { OfficerEvent } from "../types";
import { useOfficerPortal } from "../portalContext";
import { getInitialStep, buildWorkflowHistory } from "@/services/eventRequestWorkflow";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { events, approvedEvents, handleCreateEvent, submitRequest, useDb } = useOfficerPortal();
const formRef = ref<InstanceType<typeof EventRequestCreateForm> | null>(null);
const submitting = ref(false);

const workflowHint =
  "Adviser → Dean → OSAS → EO (confirm date) → GSO (if needed) → EO (publish to calendar)";

watch(
  () => props.open,
  (o) => {
    if (!o) formRef.value?.resetForm();
  },
);

async function onSubmit(payload: EventRequestFormPayload) {
  const equipmentSummary = payload.equipment
    .map((e) => `${e.equipmentName} (x${e.quantity})`)
    .join(", ");

  if (useDb?.value && submitRequest) {
    submitting.value = true;
    try {
      await submitRequest({
        requestType: "student_officer",
        organizationId: payload.organizationId,
        activity: payload.activity,
        startDate: payload.startDate,
        endDate: payload.endDate,
        startTime: payload.startTime,
        endTime: payload.endTime,
        venue: payload.venue,
        numberOfParticipants: payload.numberOfParticipants,
        sdgs: payload.sdgs,
        needsGso: payload.needsGso,
        letterFile: payload.letterFile,
        equipment: payload.equipment,
      });
      emit("close");
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      submitting.value = false;
    }
    return;
  }

  const initialStep = getInitialStep("student_officer");
  const workflowSteps = buildWorkflowHistory("student_officer", initialStep, payload.needsGso, []);

  const numericIds = [...events.value, ...approvedEvents.value]
    .map((e) => parseInt(e.id, 10))
    .filter((n) => !Number.isNaN(n));
  const nextId = String((numericIds.length ? Math.max(...numericIds) : 0) + 1);

  const newEventData: OfficerEvent = {
    id: nextId,
    name: payload.activity,
    organization: payload.organizationName,
    date: payload.startDate,
    startDate: payload.startDate,
    endDate: payload.endDate,
    venue: payload.venue,
    status: "Pending",
    workflowStatus: "Pending Adviser",
    startTime: payload.startTime,
    endTime: payload.endTime,
    participants: payload.numberOfParticipants,
    sdgs: payload.sdgs,
    createdBy: "Organization",
    needsGSO: payload.needsGso,
    itemsEquipment: equipmentSummary,
    workflowHistory: workflowSteps,
  };
  handleCreateEvent(newEventData);
  emit("close");
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    role="dialog"
    aria-modal="true"
    @click.self="emit('close')"
  >
    <div
      class="mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
      @click.stop
    >
      <div class="flex shrink-0 items-center justify-between bg-[#16A34A] px-6 py-4 text-white">
        <h3 class="text-base font-bold">Create event request</h3>
        <button type="button" class="rounded-lg p-1.5 transition hover:bg-[#15803D]" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-auto p-6">
        <EventRequestCreateForm
          ref="formRef"
          request-type="student_officer"
          :workflow-hint="workflowHint"
          :submitting="submitting"
          @submit="onSubmit"
          @cancel="emit('close')"
        />
      </div>
    </div>
  </div>
</template>
