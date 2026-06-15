<script setup lang="ts">
import { computed, useAttrs } from "vue";
import { X } from "lucide-vue-next";
import { useOnEscape } from "@/composables/useOnEscape";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    size?: "sm" | "md" | "lg" | "xl";
    closeOnBackdrop?: boolean;
  }>(),
  { size: "md", closeOnBackdrop: true },
);

const emit = defineEmits<{ "update:modelValue": [v: boolean]; close: [] }>();

const attrs = useAttrs();

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit("update:modelValue", v),
});

useOnEscape(computed(() => props.modelValue), () => {
  open.value = false;
  emit("close");
});

const panelClass = computed(() => {
  const base =
    "relative flex max-h-[min(92dvh,900px)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl ring-1 ring-slate-900/[0.04]";
  const sizes: Record<typeof props.size, string> = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };
  return [base, sizes[props.size]];
});

function onBackdrop() {
  if (!props.closeOnBackdrop) return;
  open.value = false;
  emit("close");
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
        role="presentation"
      >
        <div
          class="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
          aria-hidden="true"
          @click="onBackdrop"
        />
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="translate-y-4 opacity-0 sm:translate-y-0 sm:scale-[0.98]"
          enter-to-class="translate-y-0 opacity-100 sm:scale-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="translate-y-0 opacity-100 sm:scale-100"
          leave-to-class="translate-y-3 opacity-0 sm:translate-y-0 sm:scale-[0.98]"
        >
          <div
            v-if="modelValue"
            :class="panelClass"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="title ? 'portal-modal-title' : undefined"
            v-bind="attrs"
          >
            <header
              v-if="title || $slots.title"
              class="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4"
            >
              <div class="min-w-0 flex-1">
                <slot name="title">
                  <h2 id="portal-modal-title" class="text-base font-semibold text-slate-900 sm:text-lg">
                    {{ title }}
                  </h2>
                </slot>
              </div>
              <button
                type="button"
                class="-mr-1 shrink-0 rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close dialog"
                @click="open = false; emit('close')"
              >
                <X class="h-5 w-5" />
              </button>
            </header>

            <div class="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
              <slot />
            </div>

            <footer v-if="$slots.footer" class="shrink-0 border-t border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
              <slot name="footer" />
            </footer>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
