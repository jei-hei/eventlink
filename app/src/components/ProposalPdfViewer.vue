<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { X, ZoomIn, ZoomOut } from "lucide-vue-next";
import { getEventLetterSignedUrl, letterFileNameFromPath, isPdfPath } from "@/services/eventLetterStorage";

const props = defineProps<{
  letterPath: string;
  label?: string;
}>();

const emit = defineEmits<{ close: [] }>();

const loading = ref(true);
const error = ref("");
const signedUrl = ref<string | null>(null);
const zoom = ref(100);

async function load() {
  loading.value = true;
  error.value = "";
  signedUrl.value = null;
  try {
    const url = await getEventLetterSignedUrl(props.letterPath);
    if (!url) {
      error.value = "Could not open the proposal PDF.";
      return;
    }
    signedUrl.value = url;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load PDF.";
  } finally {
    loading.value = false;
  }
}

onMounted(() => void load());
watch(
  () => props.letterPath,
  () => void load(),
);

function zoomIn() {
  zoom.value = Math.min(200, zoom.value + 25);
}

function zoomOut() {
  zoom.value = Math.max(50, zoom.value - 25);
}
</script>

<template>
  <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3 sm:p-6" @click.self="emit('close')">
    <div class="flex h-[min(92vh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
      <div class="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div class="min-w-0">
          <p class="text-xs font-bold uppercase tracking-wider text-slate-500">
            {{ label || "Proposal PDF" }}
          </p>
          <p class="truncate text-sm font-semibold text-slate-800">
            {{ letterFileNameFromPath(letterPath) }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <button
            v-if="isPdfPath(letterPath)"
            type="button"
            class="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100"
            title="Zoom out"
            @click="zoomOut"
          >
            <ZoomOut :size="16" />
          </button>
          <span v-if="isPdfPath(letterPath)" class="w-12 text-center text-xs font-semibold text-slate-600">
            {{ zoom }}%
          </span>
          <button
            v-if="isPdfPath(letterPath)"
            type="button"
            class="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100"
            title="Zoom in"
            @click="zoomIn"
          >
            <ZoomIn :size="16" />
          </button>
          <button
            type="button"
            class="ml-1 rounded-lg p-2 text-slate-500 hover:bg-slate-200"
            aria-label="Close"
            @click="emit('close')"
          >
            <X :size="18" />
          </button>
        </div>
      </div>

      <div class="relative min-h-0 flex-1 bg-slate-100">
        <div v-if="loading" class="flex h-full items-center justify-center text-sm text-slate-500">
          Loading PDF…
        </div>
        <div v-else-if="error" class="flex h-full items-center justify-center px-6 text-center text-sm text-red-600">
          {{ error }}
        </div>
        <div v-else-if="signedUrl" class="h-full overflow-auto">
          <div class="flex min-h-full justify-center p-2" :style="{ minWidth: `${zoom}%` }">
            <iframe
              :src="signedUrl"
              title="Proposal PDF viewer"
              class="h-[min(80vh,780px)] w-full min-w-0 rounded border border-slate-200 bg-white"
              :style="{ width: `${zoom}%`, maxWidth: '100%' }"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
