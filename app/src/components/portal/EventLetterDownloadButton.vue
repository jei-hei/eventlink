<script setup lang="ts">
import { FileText } from "lucide-vue-next";
import { useEventLetterDownload } from "@/composables/useEventLetterDownload";

const props = defineProps<{
  event: { id: string; letterPath?: string | null };
  size?: "sm" | "md";
}>();

const { downloadingId, downloadLetter } = useEventLetterDownload();

async function onClick() {
  await downloadLetter(props.event);
}
</script>

<template>
  <button
    v-if="event.letterPath"
    type="button"
    class="inline-flex items-center gap-2 bg-gray-50 hover:bg-[#16A34A] text-gray-700 hover:text-white px-3 py-1.5 rounded-lg transition-all shadow-sm border border-gray-200 hover:border-transparent text-sm font-semibold disabled:opacity-60"
    :class="size === 'sm' ? 'text-xs px-2.5 py-1' : ''"
    :disabled="downloadingId === event.id"
    title="Download original Word file from event request"
    @click.stop="onClick"
  >
    <FileText :size="size === 'sm' ? 14 : 16" class="shrink-0" />
    {{ downloadingId === event.id ? "Preparing…" : "Download Word" }}
  </button>
  <span v-else class="text-xs text-gray-400">No file uploaded</span>
</template>
