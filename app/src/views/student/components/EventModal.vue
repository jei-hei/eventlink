<script setup lang="ts">
import { ref } from "vue";
import { X, MapPin, Calendar, Clock, Building2 } from "lucide-vue-next";
import type { StudentEvent } from "../types";
import { formatPostedAgo, getOrgColor } from "../orgColor";
import FeedbackModal from "./FeedbackModal.vue";

defineProps<{
  event: StudentEvent;
}>();
const emit = defineEmits<{ close: [] }>();

const feedbackOpen = ref(false);
const feedbackThanks = ref(false);

function onFeedbackSubmitted() {
  feedbackThanks.value = true;
  setTimeout(() => {
    feedbackThanks.value = false;
  }, 4000);
}
</script>

<template>
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="event-details-title"
    @click.self="emit('close')"
  >
    <div
      class="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      @click.stop
    >
      <div class="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
        <h2 id="event-details-title" class="text-xl font-bold text-gray-900">Event post</h2>
        <button
          type="button"
          class="text-gray-500 hover:bg-gray-100 rounded-full p-2 transition-colors"
          aria-label="Close"
          @click="emit('close')"
        >
          <X class="w-6 h-6" />
        </button>
      </div>

      <div class="border-b border-gray-200 p-4">
        <div class="flex items-center gap-3">
          <div
            :class="[
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white shadow',
              getOrgColor(event.organization),
            ]"
          >
            {{ event.organization.charAt(0) }}
          </div>
          <div>
            <p class="font-semibold text-gray-900">{{ event.organization }}</p>
            <p class="text-xs text-gray-500">{{ formatPostedAgo(event.postedAt, event.day) }}</p>
          </div>
        </div>
        <p v-if="event.caption" class="mt-4 whitespace-pre-wrap text-gray-800 leading-relaxed">{{ event.caption }}</p>
      </div>

      <img
        v-if="event.imageUrl"
        :src="event.imageUrl"
        :alt="event.title"
        class="w-full max-h-72 object-cover border-b border-gray-200"
      />

      <div class="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-b border-gray-200">
        <h3 class="text-2xl font-bold text-gray-900">{{ event.title }}</h3>
      </div>

      <div class="p-6 space-y-5">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div class="flex items-start gap-3">
            <div class="bg-green-100 p-3 rounded-lg shrink-0">
              <Calendar class="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p class="text-sm text-gray-500 font-medium">Date</p>
              <p class="text-lg font-semibold text-gray-900">{{ event.date }}</p>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <div class="bg-blue-100 p-3 rounded-lg shrink-0">
              <Clock class="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p class="text-sm text-gray-500 font-medium">Time</p>
              <p class="text-lg font-semibold text-gray-900">{{ event.time }}</p>
            </div>
          </div>

          <div class="flex items-start gap-3 sm:col-span-2">
            <div class="bg-purple-100 p-3 rounded-lg shrink-0">
              <MapPin class="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p class="text-sm text-gray-500 font-medium">Venue</p>
              <p class="text-lg font-semibold text-gray-900">{{ event.venue }}</p>
              <p class="text-sm text-gray-600">ISU Echague Campus</p>
            </div>
          </div>
        </div>

        <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div class="flex items-center gap-2 mb-2">
            <Building2 class="w-5 h-5 text-gray-600" />
            <h5 class="font-semibold text-gray-900">About this event</h5>
          </div>
          <p class="text-gray-700 leading-relaxed">
            <template v-if="event.caption">{{ event.caption }}</template>
            <template v-else>
              Join us for {{ event.title }} hosted by {{ event.organization }} at {{ event.venue }} on
              {{ event.date }} at {{ event.time }}.
            </template>
          </p>
        </div>
      </div>

      <div class="sticky bottom-0 bg-white border-t border-gray-200 p-4 space-y-2">
        <p v-if="feedbackThanks" class="text-center text-sm font-medium text-green-700">
          Thank you — your feedback was submitted.
        </p>
        <button
          type="button"
          class="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors"
          @click="feedbackOpen = true"
        >
          💬 Leave feedback
        </button>
      </div>
    </div>

    <FeedbackModal
      :open="feedbackOpen"
      :event-title="event.title"
      :feed-post-id="event.id"
      :request-id="event.requestId"
      @close="feedbackOpen = false"
      @submitted="onFeedbackSubmitted"
    />
  </div>
</template>
