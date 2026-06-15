<script setup lang="ts">
import { X } from "lucide-vue-next";
import EventLetterLink from "@/components/EventLetterLink.vue";
import type { EoEvent } from "../types";

defineProps<{ event: EoEvent }>();
const emit = defineEmits<{ close: [] }>();

function statusClass(status: EoEvent["status"]) {
  if (status === "Conflict") return "bg-red-100 text-red-700";
  if (status === "Approved") return "bg-green-100 text-green-700";
  return "bg-yellow-100 text-yellow-700";
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="emit('close')">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
      <div class="bg-[#16A34A] text-white px-6 py-4 flex items-center justify-between">
        <h3 class="font-bold text-base">Event Details</h3>
        <button type="button" class="hover:bg-[#15803D] p-1.5 rounded-lg transition" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="p-6 space-y-4">
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Event Name</label>
          <p class="text-gray-800 font-medium">{{ event.name }}</p>
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Organization</label>
          <p class="text-gray-800 font-medium">{{ event.organization }}</p>
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Date</label>
          <p class="text-gray-800 font-medium">{{ event.date }}</p>
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Venue</label>
          <p class="text-gray-800 font-medium">{{ event.venue }}</p>
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Description</label>
          <p class="text-gray-800 text-sm whitespace-pre-wrap">{{ event.description || "No description provided." }}</p>
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">No. of Participants</label>
          <p class="text-gray-800 font-medium">{{ event.participants ?? "—" }}</p>
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">SDG/s</label>
          <p class="text-gray-800 font-medium">{{ event.sdgs ?? "—" }}</p>
        </div>
        <EventLetterLink v-if="event.letterPath" :letter-path="event.letterPath" />
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Status</label>
          <span :class="['px-2.5 py-1 rounded-full text-xs font-semibold inline-block', statusClass(event.status)]">
            {{ event.status }}
          </span>
        </div>
      </div>

      <div class="px-6 py-4 bg-gray-50 flex gap-3 justify-end border-t border-gray-200">
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
