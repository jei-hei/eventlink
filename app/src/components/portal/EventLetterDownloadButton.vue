<script setup lang="ts">
import { ref } from "vue";
import { FileText } from "lucide-vue-next";
import ProposalPdfViewer from "@/components/ProposalPdfViewer.vue";
import { isPdfPath } from "@/services/eventLetterStorage";
import { downloadEventLetter } from "@/services/eventLetterStorage";

const props = defineProps<{
  event: { id: string; letterPath?: string | null };
  size?: "sm" | "md";
}>();

const open = ref(false);
const loading = ref(false);

async function onClick() {
  if (!props.event.letterPath) return;
  if (isPdfPath(props.event.letterPath)) {
    open.value = true;
    return;
  }
  loading.value = true;
  try {
    await downloadEventLetter(props.event.letterPath);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <button
    v-if="event.letterPath"
    type="button"
    class="inline-flex items-center gap-2 bg-gray-50 hover:bg-[#16A34A] text-gray-700 hover:text-white px-3 py-1.5 rounded-lg transition-all shadow-sm border border-gray-200 hover:border-transparent text-sm font-semibold disabled:opacity-60"
    :class="size === 'sm' ? 'text-xs px-2.5 py-1' : ''"
    :disabled="loading"
    title="View proposal PDF"
    @click.stop="onClick"
  >
    <FileText :size="size === 'sm' ? 14 : 16" class="shrink-0" />
    {{ loading ? "Opening…" : "View PDF" }}
  </button>
  <span v-else class="text-xs text-gray-400">No PDF uploaded</span>
  <ProposalPdfViewer
    v-if="open && event.letterPath"
    :letter-path="event.letterPath"
    label="Proposal PDF"
    @close="open = false"
  />
</template>
