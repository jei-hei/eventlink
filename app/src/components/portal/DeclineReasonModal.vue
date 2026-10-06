<script setup lang="ts">
import { computed, ref, watch } from "vue";
import PortalModal from "@/components/portal/PortalModal.vue";
import { DECLINE_REASON_MAX_LENGTH, useDeclineReasonDialog } from "@/composables/useDeclineReasonDialog";

const { open, eventName, confirm, cancel } = useDeclineReasonDialog();

const reason = ref("");
const error = ref("");

const modelOpen = computed({
  get: () => open.value,
  set: (v: boolean) => {
    if (!v) cancel();
  },
});

watch(open, (v) => {
  if (v) {
    reason.value = "";
    error.value = "";
  }
});

function submit() {
  if (!reason.value.trim()) {
    error.value = "A decline reason is required.";
    return;
  }
  confirm(reason.value);
}
</script>

<template>
  <PortalModal v-model="modelOpen" title="Decline request" size="sm" :close-on-backdrop="false">
    <div class="space-y-3">
      <p class="text-sm text-slate-600">
        You are declining
        <span class="font-semibold text-slate-800">{{ eventName || "this event" }}</span>.
        The requester will see this reason.
      </p>
      <label class="block">
        <span class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Reason for decline *</span>
        <textarea
          v-model="reason"
          rows="4"
          :maxlength="DECLINE_REASON_MAX_LENGTH"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
          placeholder="Explain why this request is declined…"
          @input="error = ''"
        />
        <span class="mt-0.5 block text-right text-[11px] text-gray-400">
          {{ reason.length }} / {{ DECLINE_REASON_MAX_LENGTH }}
        </span>
      </label>
      <p v-if="error" class="text-xs text-red-600">{{ error }}</p>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
          @click="cancel"
        >
          Cancel
        </button>
        <button
          type="button"
          class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          :disabled="!reason.trim()"
          @click="submit"
        >
          Decline request
        </button>
      </div>
    </template>
  </PortalModal>
</template>
