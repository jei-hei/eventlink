<script setup lang="ts">
import { ref } from "vue";
import { CheckCircle, X, XCircle } from "lucide-vue-next";
import EventLetterLink from "@/components/EventLetterLink.vue";
import ComplianceRevisionModal from "@/components/portal/ComplianceRevisionModal.vue";
import type { OsasEvent } from "../types";

const props = defineProps<{ event: OsasEvent }>();
const emit = defineEmits<{
  close: [];
  approve: [];
  reject: [];
  requestRevision: [comment: string, attachmentFile: File | null];
}>();

const revisionOpen = ref(false);
const revisionSubmitting = ref(false);

function statusClass(status: OsasEvent["status"]) {
  if (status === "Conflict") return "bg-red-100 text-red-700";
  if (status === "Approved") return "bg-green-100 text-green-700";
  return "bg-yellow-100 text-yellow-700";
}

const showOrgActions = props.event.createdBy !== "EO" && props.event.status === "Pending";
const showCloseOnly = props.event.createdBy === "EO" || props.event.status !== "Pending";

async function onRevisionSubmit(payload: { comment: string; attachmentFile: File | null }) {
  revisionSubmitting.value = true;
  try {
    emit("requestRevision", payload.comment, payload.attachmentFile);
    revisionOpen.value = false;
  } finally {
    revisionSubmitting.value = false;
  }
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="emit('close')">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
      <div class="bg-[#16A34A] text-white px-6 py-4 flex items-center justify-between shrink-0">
        <h3 class="font-bold text-base">
          {{ event.createdBy === "EO" ? "OSAS Created Event" : "Event Request" }}
        </h3>
        <button type="button" class="hover:bg-[#15803D] p-1.5 rounded-lg transition" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="p-6 space-y-4 overflow-auto flex-1 min-h-0">
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Event Title</label>
          <p class="text-gray-800 font-medium">{{ event.name }}</p>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Event Type</label>
          <p class="text-gray-800 font-medium">{{ event.eventType ?? "N/A" }}</p>
        </div>

        <template v-if="event.createdBy !== 'EO' && event.requesterName">
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Requester Name</label>
            <p class="text-gray-800 font-medium">{{ event.requesterName }}</p>
          </div>
          <div v-if="event.requesterRole">
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Requester Role</label>
            <p class="text-gray-800 font-medium">{{ event.requesterRole }}</p>
          </div>
        </template>

        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Organization / Department</label>
          <p class="text-gray-800 font-medium">{{ event.organization }}</p>
        </div>

        <div v-if="event.activity">
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Activity</label>
          <p class="text-gray-800 font-medium">{{ event.activity }}</p>
        </div>

        <div v-if="event.purpose">
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Purpose of Event</label>
          <p class="text-gray-800 text-sm whitespace-pre-wrap">{{ event.purpose }}</p>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Date</label>
            <p class="text-gray-800 font-medium">{{ event.date }}</p>
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Venue Requested</label>
            <p class="text-gray-800 font-medium">{{ event.venue }}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Start Time</label>
            <p class="text-gray-800 font-medium">{{ event.startTime ?? "N/A" }}</p>
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">End Time</label>
            <p class="text-gray-800 font-medium">{{ event.endTime ?? "N/A" }}</p>
          </div>
        </div>

        <div v-if="event.participants || event.sdgs" class="grid grid-cols-2 gap-4">
          <div v-if="event.participants">
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Participants</label>
            <p class="text-gray-800 font-medium">{{ event.participants }}</p>
          </div>
          <div v-if="event.sdgs">
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">SDG/s</label>
            <p class="text-gray-800 font-medium">{{ event.sdgs }}</p>
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Items or Equipment Needed</label>
          <p class="text-gray-800 text-sm whitespace-pre-wrap">{{ event.itemsEquipment || "No items or equipment specified." }}</p>
        </div>

        <EventLetterLink v-if="event.letterPath" :letter-path="event.letterPath" label="Proposal PDF" :current="true" />
        <div v-else-if="event.letterContent">
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Full Event Letter Content</label>
          <div class="text-gray-800 text-sm whitespace-pre-wrap bg-gray-50 p-3 rounded-lg border border-gray-200">
            {{ event.letterContent }}
          </div>
        </div>

        <div v-if="event.description">
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Full Event Content</label>
          <div class="text-gray-800 text-sm whitespace-pre-wrap bg-gray-50 p-3 rounded-lg border border-gray-200">
            {{ event.description }}
          </div>
        </div>

        <div v-if="event.remarks">
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Notes</label>
          <p class="text-gray-800 text-sm whitespace-pre-wrap">{{ event.remarks }}</p>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Current Status</label>
          <span :class="['px-2.5 py-1 rounded-full text-xs font-semibold inline-block', statusClass(event.status)]">
            {{ event.status }}
          </span>
        </div>

        <div v-if="event.createdBy === 'EO' && event.assignedTo" class="bg-blue-50 border border-blue-200 p-3 rounded-lg">
          <p class="text-xs text-blue-800 font-medium">
            <span class="font-bold">Assigned To:</span> {{ event.assignedTo }}
          </p>
        </div>
      </div>

      <div class="px-6 py-4 bg-gray-50 flex gap-3 justify-end border-t border-gray-200 shrink-0 flex-wrap">
        <template v-if="showOrgActions">
          <button
            type="button"
            class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition"
            @click="revisionOpen = true"
          >
            Request Revision
          </button>
          <button
            type="button"
            class="px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-lg text-sm font-semibold transition flex items-center gap-2"
            @click="emit('reject')"
          >
            <XCircle :size="15" />
            Decline
          </button>
          <button
            type="button"
            class="px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-lg text-sm font-semibold transition flex items-center gap-2"
            @click="emit('approve')"
          >
            <CheckCircle :size="15" />
            Approve
          </button>
        </template>
        <button
          v-if="showCloseOnly"
          type="button"
          class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-semibold transition"
          @click="emit('close')"
        >
          Close
        </button>
        <button
          v-else-if="!showOrgActions"
          type="button"
          class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-semibold transition"
          @click="emit('close')"
        >
          Close
        </button>
      </div>
    </div>

    <ComplianceRevisionModal
      :open="revisionOpen"
      :submitting="revisionSubmitting"
      :event-name="event.name"
      @close="revisionOpen = false"
      @submit="onRevisionSubmit"
    />
  </div>
</template>
