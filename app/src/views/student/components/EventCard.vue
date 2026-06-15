<script setup lang="ts">
import { MoreHorizontal } from "lucide-vue-next";
import type { StudentEvent } from "../types";
import { formatPostedAgo, getOrgColor } from "../orgColor";

defineProps<{
  event: StudentEvent;
}>();

const emit = defineEmits<{ select: [] }>();
</script>

<template>
  <article
    class="overflow-hidden rounded-lg border border-gray-300 bg-white transition-shadow duration-200 hover:shadow-md cursor-pointer"
    role="button"
    tabindex="0"
    @click="emit('select')"
    @keydown.enter.prevent="emit('select')"
  >
    <div class="flex items-center gap-3 p-4 pb-2">
      <div
        :class="[
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white shadow-sm',
          getOrgColor(event.organization),
        ]"
      >
        {{ event.organization.charAt(0) }}
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1">
          <h3 class="truncate font-semibold text-gray-900 hover:underline">
            {{ event.organization }}
          </h3>
          <span v-if="event.organization === 'Supreme Student Council'" class="shrink-0 text-blue-500">✓</span>
        </div>
        <p class="text-xs text-gray-500">
          {{ formatPostedAgo(event.postedAt, event.day) }} · 🌐 Public
        </p>
      </div>

      <button
        type="button"
        class="shrink-0 rounded-full p-2 text-gray-500 hover:bg-gray-100"
        aria-label="More options"
        @click.stop
      >
        <MoreHorizontal class="h-5 w-5" />
      </button>
    </div>

    <div class="px-4 pb-3">
      <p v-if="event.caption" class="whitespace-pre-wrap text-[15px] leading-relaxed text-gray-900">
        {{ event.caption }}
      </p>
      <p v-else class="text-[15px] leading-relaxed text-gray-800">
        {{ event.title }}
      </p>
    </div>

    <img
      v-if="event.imageUrl"
      :src="event.imageUrl"
      :alt="event.title"
      class="max-h-80 w-full border-y border-gray-100 object-cover"
    />

    <div class="border-t border-gray-100 bg-gray-50/80 px-4 py-3">
      <p class="font-semibold text-gray-900">{{ event.title }}</p>
      <div class="mt-1 space-y-0.5 text-sm text-gray-600">
        <p>📅 {{ event.date }} · {{ event.time }}</p>
        <p>📍 {{ event.venue }}</p>
      </div>
    </div>
  </article>
</template>
