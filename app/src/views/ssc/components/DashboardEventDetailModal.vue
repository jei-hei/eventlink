<script setup lang="ts">
import { X } from "lucide-vue-next";
import EventLetterLink from "@/components/EventLetterLink.vue";
import type { SscEvent } from "../types";

defineProps<{ event: SscEvent | null }>();
const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <div
    v-if="event"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    role="dialog"
    aria-modal="true"
    @click.self="emit('close')"
  >
    <div
      class="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col"
      @click.stop
    >
      <div
        :class="[
          'text-white px-6 py-4 flex items-center justify-between shrink-0',
          event.createdBy === 'EO' ? 'bg-purple-600' : 'bg-[#16A34A]',
        ]"
      >
        <h3 class="font-bold text-base">
          {{ event.createdBy === "EO" ? "EO Direct Request Details" : "Event Request Details" }}
        </h3>
        <button
          type="button"
          :class="[
            'p-1.5 rounded-lg transition',
            event.createdBy === 'EO' ? 'hover:bg-purple-700' : 'hover:bg-[#15803D]',
          ]"
          @click="emit('close')"
        >
          <X :size="18" />
        </button>
      </div>

      <div class="p-6 space-y-4 overflow-auto flex-1 min-h-0">
        <div v-if="event.createdBy === 'EO'" class="bg-purple-50 border-l-4 border-purple-600 p-3 rounded-r-lg">
          <div class="flex items-center gap-2">
            <span class="text-purple-700 font-bold text-sm">⚡ EO Direct Request</span>
          </div>
          <p class="text-purple-600 text-xs mt-1">
            This event was created by the Executive Officer and will be approved directly.
          </p>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Event Title</label>
          <p class="text-gray-800 font-medium">{{ event.name }}</p>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Event Type</label>
          <span
            :class="[
              'px-2.5 py-1 rounded text-xs font-semibold inline-block',
              event.eventType === 'Student Event' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700',
            ]"
          >
            {{ event.eventType || "N/A" }}
          </span>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
            Organization / Department
          </label>
          <p class="text-gray-800 font-medium">{{ event.organization }}</p>
        </div>

        <div v-if="event.purpose">
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Purpose of Event</label>
          <p class="text-gray-800 text-sm whitespace-pre-wrap">{{ event.purpose }}</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Date</label>
            <p class="text-gray-800 font-medium">{{ event.date }}</p>
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Venue Requested</label>
            <p class="text-gray-800 font-medium">{{ event.venue }}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Start Time</label>
            <p class="text-gray-800 font-medium">{{ event.startTime || "N/A" }}</p>
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">End Time</label>
            <p class="text-gray-800 font-medium">{{ event.endTime || "N/A" }}</p>
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
            Items or Equipment Needed
          </label>
          <p class="text-gray-800 text-sm whitespace-pre-wrap">
            {{ event.itemsEquipment || "No items or equipment specified." }}
          </p>
        </div>

        <EventLetterLink v-if="event.letterPath" :letter-path="event.letterPath" label="Current letter / document" />
        <div v-if="event.letterHistory && event.letterHistory.length > 1" class="space-y-2">
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider">Document history</label>
          <EventLetterLink
            v-for="doc in event.letterHistory"
            :key="doc.id"
            :letter-path="doc.letterPath"
            :label="doc.label"
          />
        </div>
        <div v-else-if="event.letterContent">
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
            Full Event Letter Content
          </label>
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
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
            Remarks / Special Instructions
          </label>
          <p class="text-gray-800 text-sm whitespace-pre-wrap">{{ event.remarks }}</p>
        </div>

        <div v-if="event.createdBy !== 'EO'">
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            Approval Workflow Tracker
          </label>
          <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div v-if="event.workflowHistory && event.workflowHistory.length" class="space-y-0">
              <div v-for="(step, index) in event.workflowHistory" :key="index" class="relative">
                <div class="flex items-start gap-3 pb-6 last:pb-0">
                  <div class="relative shrink-0">
                    <div
                      :class="[
                        'w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs z-10 relative',
                        step.status === 'completed'
                          ? 'bg-[#16A34A] text-white'
                          : step.status === 'current'
                            ? 'bg-yellow-400 text-gray-900 animate-pulse'
                            : 'bg-gray-300 text-gray-600',
                      ]"
                    >
                      <CheckCircle v-if="step.status === 'completed'" :size="16" />
                      <span v-else-if="step.status === 'current'">⏳</span>
                      <span v-else>⏸</span>
                    </div>
                    <div
                      v-if="index < (event.workflowHistory?.length ?? 0) - 1"
                      :class="[
                        'absolute left-1/2 -translate-x-1/2 top-8 w-0.5 h-[calc(100%+8px)]',
                        step.status === 'completed' ? 'bg-[#16A34A]' : 'bg-gray-300',
                      ]"
                    />
                  </div>
                  <div class="flex-1 pt-0.5 min-w-0">
                    <div
                      :class="[
                        'font-bold text-sm',
                        step.status === 'current'
                          ? 'text-yellow-700'
                          : step.status === 'completed'
                            ? 'text-green-700'
                            : 'text-gray-500',
                      ]"
                    >
                      {{ step.name }}
                      <span v-if="step.status === 'current'" class="ml-2 text-xs font-normal italic">
                        (Currently Here)
                      </span>
                    </div>
                    <div v-if="step.timestamp" class="text-xs text-gray-600 mt-0.5">{{ step.timestamp }}</div>
                    <div v-if="step.approver" class="text-xs text-gray-500 mt-0.5">
                      Approved by: <span class="font-semibold">{{ step.approver }}</span>
                    </div>
                    <div v-if="step.status === 'pending'" class="text-xs text-gray-400 italic mt-0.5">
                      Waiting for approval
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="text-center text-gray-400 text-sm py-4">No workflow history available</div>
          </div>
        </div>
      </div>

      <div class="px-6 py-4 bg-gray-50 flex gap-3 justify-end border-t border-gray-200 shrink-0">
        <button
          type="button"
          class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-semibold transition"
          @click="emit('close')"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>
