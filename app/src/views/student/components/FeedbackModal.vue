<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Loader2, X, Star } from "lucide-vue-next";
import {
  FEEDBACK_PRESET_COMMENTS,
  submitEventFeedback,
  verifyPublicFeedbackAccess,
} from "@/services/eventFeedbackDb";
import { isSupabaseConfigured } from "@/lib/supabase";

const props = defineProps<{
  open: boolean;
  eventTitle: string;
  feedPostId: string;
  requestId?: string | null;
  feedbackAvailable?: boolean;
  requireFeedbackAccessCode?: boolean;
}>();

const emit = defineEmits<{ close: []; submitted: [] }>();

type Step = "code" | "form";

const step = ref<Step>("form");
const rating = ref(0);
const hoveredRating = ref(0);
const selectedComment = ref("");
const accessCode = ref("");
const verifiedFeedPostId = ref<string | null>(null);
const verifying = ref(false);
const submitting = ref(false);
const errorMsg = ref("");

const needsCode = computed(() => !!props.requireFeedbackAccessCode);
const codeVerifiedForThisEvent = computed(
  () => !needsCode.value || verifiedFeedPostId.value === props.feedPostId,
);

function reset() {
  rating.value = 0;
  hoveredRating.value = 0;
  selectedComment.value = "";
  accessCode.value = "";
  verifiedFeedPostId.value = null;
  errorMsg.value = "";
  step.value = needsCode.value ? "code" : "form";
}

watch(
  () => [props.open, props.feedPostId, props.requireFeedbackAccessCode] as const,
  () => {
    if (props.open) reset();
  },
);

function close() {
  reset();
  emit("close");
}

async function handleVerify() {
  if (!needsCode.value) {
    verifiedFeedPostId.value = props.feedPostId;
    step.value = "form";
    return;
  }
  if (!accessCode.value.trim()) {
    errorMsg.value = "Enter the feedback access code.";
    return;
  }
  if (!isSupabaseConfigured) {
    window.alert("Feedback requires Supabase. Connect your project to save responses.");
    return;
  }

  verifying.value = true;
  errorMsg.value = "";
  try {
    await verifyPublicFeedbackAccess(props.feedPostId, accessCode.value.trim());
    verifiedFeedPostId.value = props.feedPostId;
    step.value = "form";
  } catch (e) {
    verifiedFeedPostId.value = null;
    errorMsg.value = e instanceof Error ? e.message : "Incorrect access code.";
  } finally {
    verifying.value = false;
  }
}

async function handleSubmit() {
  if (rating.value === 0 || !selectedComment.value) return;
  if (needsCode.value && verifiedFeedPostId.value !== props.feedPostId) {
    errorMsg.value = "Enter the feedback access code for this event first.";
    step.value = "code";
    return;
  }
  if (!isSupabaseConfigured) {
    window.alert("Feedback requires Supabase. Connect your project to save responses.");
    return;
  }

  submitting.value = true;
  errorMsg.value = "";
  try {
    await submitEventFeedback({
      feedPostId: props.feedPostId,
      requestId: props.requestId,
      rating: rating.value,
      comment: selectedComment.value,
      accessCode: needsCode.value ? accessCode.value.trim() : undefined,
    });
    emit("submitted");
    close();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("event_feedback") || msg.includes("feed_post_id")) {
      errorMsg.value =
        "Could not save feedback. Run the latest Supabase migrations, then try again.";
    } else {
      errorMsg.value = msg;
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
    role="dialog"
    aria-modal="true"
    @click.self="close"
  >
    <div class="bg-white rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col" @click.stop>
      <div
        class="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-5 rounded-t-lg flex items-center justify-between shrink-0"
      >
        <h2 class="text-xl font-bold">{{ step === "code" ? "Event passcode" : "Event Feedback" }}</h2>
        <button
          type="button"
          class="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors"
          aria-label="Close"
          @click="close"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <div v-if="step === 'code'" class="p-6 space-y-5">
        <div class="text-center">
          <p class="text-sm text-gray-500 mb-1">Give feedback for</p>
          <h3 class="text-lg font-semibold text-gray-900">{{ eventTitle }}</h3>
          <p class="mt-2 text-sm text-gray-600">
            This event requires an access code before you can open the feedback form.
          </p>
        </div>

        <div class="space-y-2">
          <label for="feedback-access-code-input" class="block text-sm font-medium text-gray-700">
            Feedback access code
          </label>
          <input
            id="feedback-access-code-input"
            v-model="accessCode"
            type="text"
            maxlength="64"
            autocomplete="off"
            placeholder="Enter the code from the organizer"
            class="input-dash w-full py-2.5 text-sm"
            @keydown.enter.prevent="handleVerify"
          />
        </div>

        <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>

        <button
          type="button"
          :disabled="verifying || !accessCode.trim()"
          :class="[
            'w-full py-3 px-6 rounded-lg font-semibold transition-colors inline-flex items-center justify-center gap-2',
            accessCode.trim() && !verifying
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed',
          ]"
          @click="handleVerify"
        >
          <Loader2 v-if="verifying" :size="18" class="animate-spin" />
          {{ verifying ? "Verifying…" : "Verify" }}
        </button>
      </div>

      <div v-else class="p-6 space-y-5 overflow-y-auto">
        <div class="text-center">
          <p class="text-sm text-gray-500 mb-1">How was</p>
          <h3 class="text-lg font-semibold text-gray-900">{{ eventTitle }}?</h3>
          <p class="mt-1 text-xs text-gray-500">Your name is not stored — rating and comment only.</p>
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700">Rate this event</label>
          <div class="flex justify-center gap-2">
            <button
              v-for="star in [1, 2, 3, 4, 5]"
              :key="star"
              type="button"
              class="transition-transform hover:scale-110"
              @click="rating = star"
              @mouseenter="hoveredRating = star"
              @mouseleave="hoveredRating = 0"
            >
              <Star
                class="w-10 h-10"
                :class="
                  star <= (hoveredRating || rating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                "
              />
            </button>
          </div>
          <p v-if="rating > 0" class="text-center text-sm text-gray-600">
            {{ rating }} {{ rating === 1 ? "star" : "stars" }}
          </p>
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700">Choose a comment</label>
          <div class="space-y-2 max-h-48 overflow-y-auto">
            <label
              v-for="comment in FEEDBACK_PRESET_COMMENTS"
              :key="comment"
              :class="[
                'flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors',
                selectedComment === comment
                  ? 'bg-green-50 border-green-500'
                  : 'bg-white border-gray-200 hover:bg-gray-50',
              ]"
            >
              <input
                v-model="selectedComment"
                type="radio"
                name="comment"
                class="w-4 h-4 text-green-600"
                :value="comment"
              />
              <span class="text-sm text-gray-700">{{ comment }}</span>
            </label>
          </div>
        </div>

        <p v-if="errorMsg" class="text-sm text-red-600">{{ errorMsg }}</p>

        <button
          type="button"
          :disabled="rating === 0 || !selectedComment || submitting || !codeVerifiedForThisEvent"
          :class="[
            'w-full py-3 px-6 rounded-lg font-semibold transition-colors inline-flex items-center justify-center gap-2',
            rating > 0 && selectedComment && !submitting && codeVerifiedForThisEvent
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed',
          ]"
          @click="handleSubmit"
        >
          <Loader2 v-if="submitting" :size="18" class="animate-spin" />
          {{ submitting ? "Submitting…" : "Submit feedback" }}
        </button>
      </div>
    </div>
  </div>
</template>
