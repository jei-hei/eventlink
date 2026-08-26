<script setup lang="ts">
import { ref, watch } from "vue";
import { Paperclip, X } from "lucide-vue-next";
import { isAllowedComplianceAttachment } from "@/services/complianceAttachmentStorage";

const props = defineProps<{
  open: boolean;
  submitting?: boolean;
  eventName?: string;
}>();

const emit = defineEmits<{
  close: [];
  submit: [payload: { comment: string; attachmentFile: File | null }];
}>();

const comment = ref("");
const attachment = ref<File | null>(null);
const error = ref("");

watch(
  () => props.open,
  (v) => {
    if (v) {
      comment.value = "";
      attachment.value = null;
      error.value = "";
    }
  },
);

function onFile(ev: Event) {
  error.value = "";
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  if (!file) {
    attachment.value = null;
    return;
  }
  if (!isAllowedComplianceAttachment(file)) {
    error.value = "Use an image, PDF, Word, or text file.";
    attachment.value = null;
    input.value = "";
    return;
  }
  attachment.value = file;
}

function submit() {
  const text = comment.value.trim();
  if (!text) {
    error.value = "Compliance comment is required.";
    return;
  }
  emit("submit", { comment: text, attachmentFile: attachment.value });
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-4"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
      <div class="flex items-center justify-between bg-amber-600 px-5 py-3 text-white">
        <h3 class="text-sm font-bold">Request Revision</h3>
        <button type="button" class="rounded p-1 hover:bg-amber-700" @click="emit('close')">
          <X :size="16" />
        </button>
      </div>
      <div class="space-y-4 p-5">
        <p v-if="eventName" class="text-sm text-slate-600">
          Send a compliance comment to the requester for
          <span class="font-semibold text-slate-800">{{ eventName }}</span>.
        </p>
        <div>
          <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">
            Compliance Comment *
          </label>
          <textarea
            v-model="comment"
            rows="4"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800"
            placeholder="Describe what needs to be corrected…"
          />
        </div>
        <div>
          <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">
            Attachment (optional)
          </label>
          <label
            class="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-sm text-gray-600 hover:border-amber-400"
          >
            <Paperclip :size="16" />
            <span class="truncate">{{ attachment?.name || "Upload file / image" }}</span>
            <input
              type="file"
              class="sr-only"
              accept="image/*,.pdf,.doc,.docx,.txt,application/pdf"
              @change="onFile"
            />
          </label>
        </div>
        <p v-if="error" class="text-xs text-red-600">{{ error }}</p>
      </div>
      <div class="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
        <button
          type="button"
          class="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700"
          :disabled="submitting"
          @click="emit('close')"
        >
          Cancel
        </button>
        <button
          type="button"
          class="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          :disabled="submitting"
          @click="submit"
        >
          {{ submitting ? "Sending…" : "Send to Requester" }}
        </button>
      </div>
    </div>
  </div>
</template>
