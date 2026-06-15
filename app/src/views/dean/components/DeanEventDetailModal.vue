<script setup lang="ts">
import { X } from "lucide-vue-next";
import EventLetterLink from "@/components/EventLetterLink.vue";
import type { DeanEvent } from "../types";

defineProps<{ event: DeanEvent }>();
const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="emit('close')">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
      <div class="bg-[#16A34A] text-white px-6 py-4 flex items-center justify-between shrink-0">
        <h3 class="font-bold text-base">Event Request Details</h3>
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
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Organization / Department</label>
          <p class="text-gray-800 font-medium">{{ event.organization }}</p>
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

        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Participants</label>
          <p class="text-gray-800 text-sm whitespace-pre-wrap">{{ event.participants || "Not specified" }}</p>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">SDG/s (Sustainable Development Goals)</label>
          <p class="text-gray-800 text-sm whitespace-pre-wrap">{{ event.sdgs || "Not specified" }}</p>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Items or Equipment Needed</label>
          <p class="text-gray-800 text-sm whitespace-pre-wrap">{{ event.itemsEquipment || "No items or equipment specified." }}</p>
        </div>

        <EventLetterLink v-if="event.letterPath" :letter-path="event.letterPath" />
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
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Remarks / Special Instructions</label>
          <p class="text-gray-800 text-sm whitespace-pre-wrap">{{ event.remarks }}</p>
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
