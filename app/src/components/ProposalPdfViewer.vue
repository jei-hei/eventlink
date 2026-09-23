<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { Download, Printer, X, ZoomIn, ZoomOut } from "lucide-vue-next";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  downloadEventLetter,
  downloadEventLetterBytes,
  getEventLetterSignedUrl,
  isPdfPath,
  letterFileNameFromPath,
} from "@/services/eventLetterStorage";
import { isProposalReviewed, markProposalReviewed } from "@/utils/proposalReview";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const props = defineProps<{
  letterPath: string;
  label?: string;
}>();

const emit = defineEmits<{ close: []; reviewed: [] }>();

const loading = ref(true);
const rendering = ref(false);
const error = ref("");
const zoom = ref(100);
const pageCount = ref(0);
const canvasHost = ref<HTMLElement | null>(null);
const scrollRoot = ref<HTMLElement | null>(null);
const lastPageEl = ref<HTMLCanvasElement | null>(null);
const objectUrl = ref<string | null>(null);
const iframeFallbackUrl = ref<string | null>(null);

let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
let observer: IntersectionObserver | null = null;
let renderGen = 0;

function revokeObjectUrl() {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value);
    objectUrl.value = null;
  }
}

function disconnectObserver() {
  observer?.disconnect();
  observer = null;
}

function onLastPageVisible(entries: IntersectionObserverEntry[]) {
  const hit = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.35);
  if (!hit) return;
  markProposalReviewed(props.letterPath);
  emit("reviewed");
}

function watchLastPage() {
  disconnectObserver();
  if (!lastPageEl.value || !scrollRoot.value) return;
  if (isProposalReviewed(props.letterPath)) {
    emit("reviewed");
    return;
  }
  observer = new IntersectionObserver(onLastPageVisible, {
    root: scrollRoot.value,
    threshold: [0.35, 0.6, 1],
  });
  observer.observe(lastPageEl.value);
}

async function renderPages() {
  if (!pdfDoc || !canvasHost.value) return;
  const gen = ++renderGen;
  const host = canvasHost.value;
  host.innerHTML = "";
  lastPageEl.value = null;
  const scale = (zoom.value / 100) * (typeof window !== "undefined" && window.innerWidth < 640 ? 0.9 : 1.15);
  let lastCanvas: HTMLCanvasElement | null = null;
  rendering.value = true;
  try {
    for (let n = 1; n <= pdfDoc.numPages; n += 1) {
      if (gen !== renderGen) return;
      const page = await pdfDoc.getPage(n);
      if (gen !== renderGen) return;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.className = "mb-3 max-w-full rounded border border-slate-200 bg-white shadow-sm";
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.setAttribute("aria-label", `Page ${n} of ${pdfDoc.numPages}`);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport }).promise;
      if (gen !== renderGen) return;
      host.appendChild(canvas);
      lastCanvas = canvas;
    }
    lastPageEl.value = lastCanvas;
    await nextTick();
    watchLastPage();
    if (pdfDoc.numPages === 1) {
      markProposalReviewed(props.letterPath);
      emit("reviewed");
    }
  } finally {
    if (gen === renderGen) rendering.value = false;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function openIframeFallback(reason: string) {
  const url = await getEventLetterSignedUrl(props.letterPath);
  iframeFallbackUrl.value = url;
  error.value = url
    ? `${reason} Showing the browser PDF viewer instead. Scroll to the last page, then confirm below.`
    : reason;
}

async function load() {
  loading.value = true;
  rendering.value = false;
  error.value = "";
  pageCount.value = 0;
  iframeFallbackUrl.value = null;
  disconnectObserver();
  void pdfDoc?.destroy();
  pdfDoc = null;
  revokeObjectUrl();
  try {
    const bytes = await withTimeout(
      downloadEventLetterBytes(props.letterPath),
      20000,
      "The proposal PDF took too long to download.",
    );
    objectUrl.value = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const task = pdfjsLib.getDocument({ data: new Uint8Array(bytes) });
    pdfDoc = await withTimeout(task.promise, 20000, "The proposal PDF took too long to open.");
    pageCount.value = pdfDoc.numPages;
    loading.value = false;
    await nextTick();
    await renderPages();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load PDF.";
    try {
      await openIframeFallback(message);
    } catch {
      error.value = message;
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (typeof window !== "undefined" && window.innerWidth < 640) {
    zoom.value = 80;
  }
  void load();
});
onUnmounted(() => {
  renderGen += 1;
  disconnectObserver();
  void pdfDoc?.destroy();
  pdfDoc = null;
  revokeObjectUrl();
});

watch(
  () => props.letterPath,
  () => void load(),
);

watch(zoom, () => {
  if (!pdfDoc || loading.value) return;
  void renderPages();
});

function zoomIn() {
  zoom.value = Math.min(200, zoom.value + 25);
}

function zoomOut() {
  zoom.value = Math.max(50, zoom.value - 25);
}

async function onDownload() {
  await downloadEventLetter(props.letterPath);
}

function onPrint() {
  if (!objectUrl.value) return;
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.src = objectUrl.value;
  document.body.appendChild(frame);
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      window.setTimeout(() => frame.remove(), 1000);
    }
  };
}

function confirmIframeReviewed() {
  markProposalReviewed(props.letterPath);
  emit("reviewed");
}
</script>

<template>
  <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-2 sm:p-6" @click.self="emit('close')">
    <div class="flex h-[min(96dvh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
      <div class="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-3">
        <div class="min-w-0">
          <p class="text-xs font-bold uppercase tracking-wider text-slate-500">
            {{ label || "Proposal PDF" }}
          </p>
          <p class="truncate text-sm font-semibold text-slate-800">
            {{ letterFileNameFromPath(letterPath) }}
          </p>
          <p v-if="pageCount" class="mt-0.5 text-xs text-slate-500">
            {{ pageCount }} page{{ pageCount === 1 ? "" : "s" }}
            <span v-if="isPdfPath(letterPath) && !isProposalReviewed(letterPath)">
              · Scroll to the last page to enable Approve
            </span>
          </p>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-1">
          <button
            v-if="isPdfPath(letterPath) && !iframeFallbackUrl"
            type="button"
            class="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100"
            title="Zoom out"
            @click="zoomOut"
          >
            <ZoomOut :size="16" />
          </button>
          <span v-if="isPdfPath(letterPath) && !iframeFallbackUrl" class="w-12 text-center text-xs font-semibold text-slate-600">
            {{ zoom }}%
          </span>
          <button
            v-if="isPdfPath(letterPath) && !iframeFallbackUrl"
            type="button"
            class="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100"
            title="Zoom in"
            @click="zoomIn"
          >
            <ZoomIn :size="16" />
          </button>
          <button
            type="button"
            class="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100"
            title="Download"
            :disabled="loading"
            @click="onDownload"
          >
            <Download :size="16" />
          </button>
          <button
            type="button"
            class="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100"
            title="Print"
            :disabled="loading || !objectUrl"
            @click="onPrint"
          >
            <Printer :size="16" />
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
        <div
          v-else-if="iframeFallbackUrl"
          class="flex h-full min-h-0 flex-col"
        >
          <p v-if="error" class="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            {{ error }}
          </p>
          <iframe :src="iframeFallbackUrl" title="Proposal PDF viewer" class="min-h-0 w-full flex-1 bg-white" />
          <div
            v-if="!isProposalReviewed(letterPath)"
            class="flex shrink-0 justify-end border-t border-slate-200 bg-white px-4 py-3"
          >
            <button
              type="button"
              class="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              @click="confirmIframeReviewed"
            >
              I have reviewed this proposal
            </button>
          </div>
        </div>
        <div v-else-if="error" class="flex h-full items-center justify-center px-6 text-center text-sm text-red-600">
          {{ error }}
        </div>
        <div v-else ref="scrollRoot" class="h-full overflow-auto p-3">
          <p v-if="rendering && !pageCount" class="mb-2 text-center text-xs text-slate-500">Rendering pages…</p>
          <div ref="canvasHost" class="mx-auto flex max-w-4xl flex-col items-center" />
        </div>
      </div>
    </div>
  </div>
</template>
