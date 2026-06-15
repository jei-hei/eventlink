<script setup lang="ts">
import { CheckCircle, X } from "lucide-vue-next";
import EventLetterLink from "@/components/EventLetterLink.vue";
import type { AdviserEvent } from "../types";

const props = defineProps<{ event: AdviserEvent }>();
const emit = defineEmits<{ close: [] }>();

function stepDisplayStatus(step: { status: string }) {
  if (props.event.status === "Approved") return "completed" as const;
  return step.status as "completed" | "current" | "pending";
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="emit('close')">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
      <div class="bg-[#16A34A] text-white px-6 py-4 flex items-center justify-between shrink-0">
        <h3 class="font-bold text-base">Event Details &amp; Approval History</h3>
        <button type="button" class="hover:bg-[#15803D] p-1.5 rounded-lg transition" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="p-6 space-y-4 overflow-auto flex-1 min-h-0">
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Event Title</label>
          <p class="text-gray-800 font-medium">{{ event.name }}</p>
        </div>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-gray-500 text-xs font-bold uppercase">Organization</span>
            <p class="font-medium text-gray-800">{{ event.organization }}</p>
          </div>
          <div>
            <span class="text-gray-500 text-xs font-bold uppercase">Venue</span>
            <p class="font-medium text-gray-800">{{ event.venue }}</p>
          </div>
          <div>
            <span class="text-gray-500 text-xs font-bold uppercase">Date</span>
            <p class="font-medium text-gray-800">{{ event.date }}</p>
          </div>
          <div>
            <span class="text-gray-500 text-xs font-bold uppercase">Time</span>
            <p class="font-medium text-gray-800">
              {{ event.startTime ?? "—" }} – {{ event.endTime ?? "—" }}
            </p>
          </div>
        </div>

        <EventLetterLink v-if="event.letterPath" :letter-path="event.letterPath" />

        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Approval workflow</label>
          <div class="bg-[#F0FDF4] border border-green-200 rounded-lg p-4">
            <div v-if="event.workflowHistory && event.workflowHistory.length > 0" class="space-y-0">
              <div v-for="(step, index) in event.workflowHistory" :key="index" class="relative">
                <div class="flex items-start gap-3 pb-6 last:pb-0">
                  <div class="relative shrink-0">
                    <div
                      :class="[
                        'w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs z-10 relative',
                        stepDisplayStatus(step) === 'completed'
                          ? 'bg-[#16A34A] text-white'
                          : stepDisplayStatus(step) === 'current'
                            ? 'bg-yellow-400 text-gray-900'
                            : 'bg-gray-300 text-gray-600',
                      ]"
                    >
                      <CheckCircle v-if="stepDisplayStatus(step) === 'completed'" :size="16" />
                      <span v-else-if="stepDisplayStatus(step) === 'current'">⏳</span>
                      <span v-else>⏸</span>
                    </div>
                    <div
                      v-if="index < (event.workflowHistory?.length ?? 0) - 1"
                      class="absolute left-1/2 -translate-x-1/2 top-8 w-0.5 h-[calc(100%+8px)] bg-[#16A34A]"
                    />
                  </div>
                  <div class="flex-1 pt-0.5 min-w-0">
                    <div class="font-bold text-sm text-green-800">{{ step.name }}</div>
                    <div v-if="step.timestamp" class="text-xs text-gray-600 mt-0.5">{{ step.timestamp }}</div>
                    <div v-if="step.approver" class="text-xs text-gray-600 mt-0.5">
                      <span class="font-semibold">{{ step.approver }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="text-center text-gray-500 text-sm py-2">No workflow history recorded.</div>
          </div>
        </div>
      </div>

      <div class="px-6 py-4 bg-gray-50 flex justify-end border-t border-gray-200 shrink-0">
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
