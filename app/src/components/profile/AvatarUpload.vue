<script setup lang="ts">
import { ref } from "vue";
import { Camera } from "lucide-vue-next";

const props = defineProps<{
  displayName: string;
  modelValue: string | null;
}>();

const emit = defineEmits<{ "update:modelValue": [v: string | null] }>();

const inputRef = ref<HTMLInputElement | null>(null);

const initials = () => {
  const parts = props.displayName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
};

function onFile(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0];
  (ev.target as HTMLInputElement).value = "";
  if (!file || !file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = () => {
    const r = reader.result;
    if (typeof r === "string") emit("update:modelValue", r);
  };
  reader.readAsDataURL(file);
}

function clearPhoto() {
  emit("update:modelValue", null);
}
</script>

<template>
  <div class="flex flex-col items-center gap-3 sm:flex-row sm:items-end">
    <input ref="inputRef" type="file" accept="image/*" class="sr-only" @change="onFile" />
    <div class="relative">
      <div
        class="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-gradient-to-br from-emerald-600 to-teal-700 text-lg font-bold text-white shadow-md ring-2 ring-emerald-900/10 sm:h-24 sm:w-24 sm:text-xl"
      >
        <img v-if="modelValue" :src="modelValue" alt="" class="h-full w-full object-cover" />
        <span v-else>{{ initials() }}</span>
      </div>
    </div>
    <div class="flex flex-wrap justify-center gap-2 sm:justify-start">
      <button type="button" class="portal-btn-secondary px-3 py-1.5 text-xs" @click="inputRef?.click()">
        <Camera class="h-3.5 w-3.5" />
        Upload photo
      </button>
      <button
        v-if="modelValue"
        type="button"
        class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        @click="clearPhoto"
      >
        Remove
      </button>
    </div>
  </div>
</template>
