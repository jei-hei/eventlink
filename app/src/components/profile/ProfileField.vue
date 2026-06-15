<script setup lang="ts">
import { Copy, Check } from "lucide-vue-next";
import { ref } from "vue";

const props = withDefaults(
  defineProps<{
    label: string;
    modelValue: string;
    editable?: boolean;
    inputType?: string;
    multiline?: boolean;
    copyable?: boolean;
    disabled?: boolean;
  }>(),
  { editable: false, inputType: "text", multiline: false, copyable: false, disabled: false },
);

const emit = defineEmits<{ "update:modelValue": [v: string] }>();

const copied = ref(false);

async function copy() {
  try {
    await navigator.clipboard.writeText(props.modelValue);
    copied.value = true;
    window.setTimeout(() => {
      copied.value = false;
    }, 1600);
  } catch {
    copied.value = false;
  }
}
</script>

<template>
  <div
    class="group rounded-xl border border-slate-200/80 bg-slate-50/60 px-3 py-2.5 transition-colors focus-within:border-emerald-300 focus-within:bg-white hover:border-slate-300 sm:px-4 sm:py-3"
  >
    <div class="mb-1 flex items-center justify-between gap-2">
      <span class="text-[11px] font-bold uppercase tracking-wide text-slate-500">{{ label }}</span>
      <button
        v-if="copyable && modelValue"
        type="button"
        class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 opacity-0 transition hover:bg-emerald-100 group-hover:opacity-100 sm:opacity-100"
        @click="copy"
      >
        <Check v-if="copied" class="h-3 w-3" />
        <Copy v-else class="h-3 w-3" />
        {{ copied ? "Copied" : "Copy" }}
      </button>
    </div>
    <textarea
      v-if="editable && multiline"
      :value="modelValue"
      rows="3"
      class="portal-input min-h-[5rem] resize-y"
      :disabled="disabled"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <input
      v-else-if="editable"
      :type="inputType"
      class="portal-input"
      :value="modelValue"
      :disabled="disabled"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <p v-else class="text-sm font-medium text-slate-900">{{ modelValue || "—" }}</p>
  </div>
</template>
