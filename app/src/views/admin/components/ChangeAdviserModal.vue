<script setup lang="ts">
import { ref, watch } from "vue";
import { X } from "lucide-vue-next";

const props = defineProps<{
  open: boolean;
  currentAdviser: string;
}>();
const emit = defineEmits<{ close: []; change: [adviser: string] }>();

const selectedAdviser = ref(props.currentAdviser);

const availableAdvisers = [
  "Dr. Mike Johnson",
  "Dr. Sarah Williams",
  "Dr. Tom Brown",
  "Dr. Robert Chen",
  "Dr. Patricia Martinez",
  "Dr. James Anderson",
];

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) selectedAdviser.value = props.currentAdviser;
  },
);

watch(
  () => props.currentAdviser,
  (v) => {
    if (props.open) selectedAdviser.value = v;
  },
);

function handleSubmit(e: Event) {
  e.preventDefault();
  emit("change", selectedAdviser.value);
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full">
      <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 class="text-xl font-semibold text-gray-900">Change SSC Adviser</h2>
        <button
          type="button"
          class="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Close"
          @click="emit('close')"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <form class="p-6 space-y-4" @submit="handleSubmit">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Current Adviser</label>
          <div class="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700">
            {{ currentAdviser }}
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Select New Adviser <span class="text-red-500">*</span>
          </label>
          <select
            v-model="selectedAdviser"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option v-for="adviser in availableAdvisers" :key="adviser" :value="adviser">
              {{ adviser }}
            </option>
          </select>
        </div>

        <div class="flex gap-3 pt-4">
          <button
            type="submit"
            class="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Change Adviser
          </button>
          <button
            type="button"
            class="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            @click="emit('close')"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
