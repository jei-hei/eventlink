<script setup lang="ts">
import { storeToRefs } from "pinia";
import { X } from "lucide-vue-next";
import { useUiStore } from "@/stores/ui";

const ui = useUiStore();
const { toasts } = storeToRefs(ui);
</script>

<template>
  <div
    class="pointer-events-none fixed bottom-0 right-0 z-[110] flex max-w-[100vw] flex-col gap-2 p-3 sm:bottom-4 sm:right-4 sm:p-0"
    aria-live="polite"
  >
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-1 opacity-0"
    >
      <div
        v-for="t in toasts"
        :key="t.id"
        class="pointer-events-auto w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2.5 shadow-lg ring-1 ring-slate-900/[0.04] backdrop-blur-sm sm:px-4 sm:py-3"
        :class="{
          'border-emerald-200/80': t.variant === 'success',
          'border-red-200/80': t.variant === 'error',
          'border-sky-200/80': t.variant === 'info',
          'border-amber-200/80': t.variant === 'warning',
        }"
        role="status"
      >
        <div class="flex items-start gap-2">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-slate-900">{{ t.title }}</p>
            <p v-if="t.description" class="mt-0.5 text-xs text-slate-600">{{ t.description }}</p>
          </div>
          <button
            type="button"
            class="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Dismiss"
            @click="ui.dismissToast(t.id)"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>
