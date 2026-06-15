<script setup lang="ts">
import { computed, ref } from "vue";
import { Download, FileText } from "lucide-vue-next";
import { downloadEventLetter, letterFileNameFromPath } from "@/services/eventLetterStorage";

const props = defineProps<{
  letterPath?: string | null;
}>();

const loading = ref(false);

const fileName = computed(() =>
  props.letterPath ? letterFileNameFromPath(props.letterPath) : "letter.docx",
);

async function download() {
  if (!props.letterPath) return;
  loading.value = true;
  try {
    await downloadEventLetter(props.letterPath);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div v-if="letterPath" class="rounded-lg border border-gray-200 bg-gray-50 p-3">
    <p class="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">Uploaded Word letter</p>
    <p class="mb-2 truncate text-sm text-gray-700">{{ fileName }}</p>
    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-lg bg-[#16A34A] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#15803D] disabled:opacity-60"
      :disabled="loading"
      @click="download"
    >
      <Download :size="16" />
      {{ loading ? "Preparing…" : "Download original file" }}
    </button>
  </div>
</template>
