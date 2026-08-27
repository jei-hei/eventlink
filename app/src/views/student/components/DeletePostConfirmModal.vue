<script setup lang="ts">
import { X } from "lucide-vue-next";

defineProps<{
  open: boolean;
  eventTitle?: string;
  deleting?: boolean;
}>();

const emit = defineEmits<{ close: []; confirm: [] }>();
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
      <div class="flex items-center justify-between border-b border-gray-200 px-5 py-3">
        <h3 class="text-sm font-bold text-gray-900">Delete this post?</h3>
        <button type="button" class="rounded p-1 text-gray-500 hover:bg-gray-100" @click="emit('close')">
          <X :size="16" />
        </button>
      </div>
      <div class="space-y-2 px-5 py-4 text-sm text-gray-700">
        <p>Are you sure you want to delete this post? This will remove it from the student feed.</p>
        <p v-if="eventTitle" class="rounded-lg bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600">
          {{ eventTitle }}
        </p>
        <p class="text-xs text-gray-500">
          The linked event request, monitoring record, and calendar entry are not deleted.
        </p>
      </div>
      <div class="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
        <button
          type="button"
          class="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300 disabled:opacity-60"
          :disabled="deleting"
          @click="emit('close')"
        >
          Cancel
        </button>
        <button
          type="button"
          class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          :disabled="deleting"
          @click="emit('confirm')"
        >
          {{ deleting ? "Deleting…" : "Delete" }}
        </button>
      </div>
    </div>
  </div>
</template>
