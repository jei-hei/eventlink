<script setup lang="ts">
import { computed, ref } from "vue";
import { FileText } from "lucide-vue-next";
import { isPdfPath, letterFileNameFromPath } from "@/services/eventLetterStorage";
import ProposalPdfViewer from "@/components/ProposalPdfViewer.vue";
import { downloadEventLetter } from "@/services/eventLetterStorage";

const props = withDefaults(
  defineProps<{
    letterPath?: string | null;
    label?: string;
    current?: boolean;
  }>(),
  { label: "Proposal document", current: false },
);

const open = ref(false);
const loading = ref(false);

const fileName = computed(() =>
  props.letterPath ? letterFileNameFromPath(props.letterPath) : "proposal.pdf",
);

const canViewInline = computed(() => !!props.letterPath && isPdfPath(props.letterPath));

async function onClick() {
  if (!props.letterPath) return;
  if (canViewInline.value) {
    open.value = true;
    return;
  }
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
    <p class="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">
      {{ label }}
      <span v-if="current" class="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
        Current
      </span>
    </p>
    <p class="mb-2 truncate text-sm text-gray-700">{{ fileName }}</p>
    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-lg bg-[#16A34A] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#15803D] disabled:opacity-60"
      :disabled="loading"
      @click="onClick"
    >
      <FileText :size="16" />
      {{ loading ? "Opening…" : canViewInline ? "View PDF" : "Open file" }}
    </button>
    <ProposalPdfViewer
      v-if="open && letterPath"
      :letter-path="letterPath"
      :label="label"
      @close="open = false"
    />
  </div>
</template>
