<script setup lang="ts">
import { X } from "lucide-vue-next";
import EventLetterLink from "@/components/EventLetterLink.vue";
import type { AdviserEvent } from "../types";

defineProps<{ event: AdviserEvent }>();
const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="emit('close')">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
      <div class="bg-[#16A34A] text-white px-6 py-4 flex items-center justify-between shrink-0">
        <h3 class="font-bold text-base">Event Details</h3>
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
