<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import EventLetterLink from "@/components/EventLetterLink.vue";
import { isSupabaseConfigured } from "@/lib/supabase";
import { fetchEventRequestDocuments } from "@/services/eventRequestsDb";

const props = defineProps<{
  requestId?: string | null;
  letterPath?: string | null;
}>();

const letters = ref<Array<{ id: string; letter_path: string; label: string; created_at: string }>>([]);

const shown = computed(() => {
  if (letters.value.length) return letters.value;
  if (props.letterPath) {
    return [{ id: "current", letter_path: props.letterPath, label: "Proposal PDF", created_at: "" }];
  }
  return [];
});

onMounted(async () => {
  if (!props.requestId || !isSupabaseConfigured) return;
  try {
    const docs = await fetchEventRequestDocuments(props.requestId);
    letters.value = docs.letters
      .slice()
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  } catch {
    letters.value = [];
  }
});
</script>

<template>
  <div v-if="shown.length" class="space-y-2">
    <p v-if="shown.length > 1" class="text-xs font-bold uppercase tracking-wider text-gray-500">Proposal PDFs</p>
    <EventLetterLink
      v-for="(doc, index) in shown"
      :key="doc.id"
      :letter-path="doc.letter_path"
      :label="doc.label || `Proposal ${index + 1}`"
      :current="index === 0"
    />
  </div>
</template>
