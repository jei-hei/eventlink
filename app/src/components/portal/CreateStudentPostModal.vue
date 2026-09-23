<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ImagePlus, Loader2, Megaphone, X } from "lucide-vue-next";
import type { PortalEvent } from "@/types/portalEvent";
import type { CreateStudentFeedPostInput, UpdateStudentFeedPostInput } from "@/types/studentPost";
import { isPostImageFile } from "@/services/eventPostImageStorage";
import type { StudentEvent } from "@/views/student/types";
import { getEventSchedulePhase } from "@/utils/eventSchedulePhase";

const props = defineProps<{
  open: boolean;
  myEvents?: PortalEvent[];
  publishing?: boolean;
  /** When set, modal edits this post instead of creating a new one. */
  editPost?: StudentEvent | null;
}>();

const emit = defineEmits<{
  close: [];
  publish: [payload: CreateStudentFeedPostInput];
  save: [payload: UpdateStudentFeedPostInput];
}>();

const isEdit = computed(() => !!props.editPost?.id);

const caption = ref("");
const eventTitle = ref("");
const linkedRequestId = ref("");
const requireFeedbackCode = ref(false);
const feedbackAccessCode = ref("");
const imageFile = ref<File | null>(null);
const imageFiles = ref<File[]>([]);
const imagePreviews = ref<string[]>([]);
const existingImageUrls = ref<string[]>([]);
const imagesReplaced = ref(false);
const imageError = ref("");
const uploadingImages = computed(() => !!props.publishing && imageFiles.value.length > 0);

const postableEvents = computed(() =>
  (props.myEvents ?? []).filter(
    (ev) =>
      getEventSchedulePhase({
        startDate: ev.startDate,
        endDate: ev.endDate,
        startTime: ev.startTime,
        endTime: ev.endTime,
      }) === "completed",
  ),
);

const selectedLinkedEvent = computed(() =>
  props.myEvents?.find((e) => e.id === linkedRequestId.value) ?? null,
);

const linkedEventPhase = computed(() => {
  const ev = selectedLinkedEvent.value;
  if (!ev) return null;
  return getEventSchedulePhase({
    startDate: ev.startDate,
    endDate: ev.endDate,
    startTime: ev.startTime,
    endTime: ev.endTime,
  });
});

const feedbackEnabled = computed(() => linkedEventPhase.value === "completed");

function revokeLocalPreviews() {
  imagePreviews.value.forEach((url) => {
    if (url.startsWith("blob:")) URL.revokeObjectURL(url);
  });
}

function reset() {
  caption.value = "";
  eventTitle.value = "";
  linkedRequestId.value = "";
  requireFeedbackCode.value = false;
  feedbackAccessCode.value = "";
  imageFile.value = null;
  imageFiles.value = [];
  revokeLocalPreviews();
  imagePreviews.value = [];
  existingImageUrls.value = [];
  imagesReplaced.value = false;
  imageError.value = "";
}

function fillFromEdit(post: StudentEvent) {
  caption.value = post.caption ?? "";
  eventTitle.value = post.title ?? "";
  linkedRequestId.value = post.requestId ?? "";
  requireFeedbackCode.value = !!post.requireFeedbackAccessCode;
  feedbackAccessCode.value = "";
  imageFile.value = null;
  imageFiles.value = [];
  revokeLocalPreviews();
  const urls = post.imageUrls?.length ? [...post.imageUrls] : post.imageUrl ? [post.imageUrl] : [];
  existingImageUrls.value = urls;
  imagePreviews.value = [...urls];
  imagesReplaced.value = false;
  imageError.value = "";
}

watch(
  () => [props.open, props.editPost?.id] as const,
  ([isOpen]) => {
    if (!isOpen) {
      reset();
      return;
    }
    if (props.editPost) {
      fillFromEdit(props.editPost);
    } else {
      reset();
    }
  },
);

watch(linkedRequestId, () => {
  if (!feedbackEnabled.value) {
    requireFeedbackCode.value = false;
    feedbackAccessCode.value = "";
  }
  applyLinkedEvent();
});

function close() {
  reset();
  emit("close");
}

function applyLinkedEvent() {
  const ev = selectedLinkedEvent.value;
  if (!ev) return;
  eventTitle.value = ev.name;
}

function onImageChange(ev: Event) {
  imageError.value = "";
  const input = ev.target as HTMLInputElement;
  const picked = Array.from(input.files ?? []);
  if (!picked.length) return;
  if (picked.length > 10) {
    imageError.value = "You can upload up to 10 images per post.";
    input.value = "";
    return;
  }
  const valid: File[] = [];
  for (const file of picked) {
    if (!isPostImageFile(file)) {
      imageError.value = "Use JPEG, PNG, WebP, or GIF.";
      input.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      imageError.value = "Each image must be 5 MB or smaller.";
      input.value = "";
      return;
    }
    valid.push(file);
  }
  revokeLocalPreviews();
  imageFile.value = valid[0] ?? null;
  imageFiles.value = valid;
  imagePreviews.value = valid.map((file) => URL.createObjectURL(file));
  imagesReplaced.value = true;
  existingImageUrls.value = [];
}

function removeImage(index: number) {
  if (index < 0 || index >= imagePreviews.value.length) return;
  if (imagesReplaced.value || imageFiles.value.length) {
    const nextFiles = [...imageFiles.value];
    const nextPreviews = [...imagePreviews.value];
    const [removedPreview] = nextPreviews.splice(index, 1);
    nextFiles.splice(index, 1);
    if (removedPreview?.startsWith("blob:")) URL.revokeObjectURL(removedPreview);
    imageFiles.value = nextFiles;
    imagePreviews.value = nextPreviews;
    imageFile.value = imageFiles.value[0] ?? null;
    imagesReplaced.value = true;
  } else {
    const next = [...existingImageUrls.value];
    next.splice(index, 1);
    existingImageUrls.value = next;
    imagePreviews.value = [...next];
  }
  imageError.value = "";
}

function submit() {
  if (props.publishing) return;
  const text = caption.value.trim();
  const title = eventTitle.value.trim();
  if (!title) {
    window.alert("Enter an event title for this post.");
    return;
  }
  if (!text) {
    window.alert("Write a caption for your post.");
    return;
  }

  if (!isEdit.value && linkedRequestId.value && linkedEventPhase.value !== "completed") {
    window.alert(
      linkedEventPhase.value === "ongoing"
        ? "This linked event is still ongoing. Wait until it finishes before posting for evaluation."
        : "This linked event has not started yet. You can post for evaluation only after the event is completed.",
    );
    return;
  }

  if (!isEdit.value && requireFeedbackCode.value && !feedbackAccessCode.value.trim()) {
    window.alert("Enter an access code for feedback, or turn off the access-code requirement.");
    return;
  }

  if (isEdit.value && props.editPost) {
    const ev = selectedLinkedEvent.value;
    const payload: UpdateStudentFeedPostInput = {
      postId: props.editPost.id,
      caption: text,
      eventTitle: title,
      eventDate: ev?.date || undefined,
      eventTime: [ev?.startTime, ev?.endTime].filter(Boolean).join(" – ") || undefined,
      venue: ev?.venue || undefined,
      requestId: linkedRequestId.value || null,
    };
    if (imagesReplaced.value) {
      payload.imageFiles = imageFiles.value;
      payload.imageFile = imageFile.value;
    }
    emit("save", payload);
    return;
  }

  const ev = selectedLinkedEvent.value;
  emit("publish", {
    caption: text,
    eventTitle: title,
    eventDate: ev?.date || undefined,
    eventTime: [ev?.startTime, ev?.endTime].filter(Boolean).join(" – ") || undefined,
    venue: ev?.venue || undefined,
    requestId: linkedRequestId.value || null,
    imageFile: imageFile.value,
    imageFiles: imageFiles.value,
    requireFeedbackAccessCode: feedbackEnabled.value && requireFeedbackCode.value,
    feedbackAccessCode: requireFeedbackCode.value ? feedbackAccessCode.value.trim() : undefined,
  });
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-student-post-title"
      @click.self="close"
    >
      <div
        class="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        @click.stop
      >
        <div class="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div class="flex items-center gap-2">
            <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-[#16A34A] text-white">
              <Megaphone :size="18" />
            </div>
            <div>
              <h2 id="create-student-post-title" class="text-base font-bold text-gray-900">
                {{ isEdit ? "Edit post" : "Create post" }}
              </h2>
              <p class="text-xs text-gray-500">
                {{ isEdit ? "Update details shown on the student feed" : "Caption and optional photo for the student feed" }}
              </p>
            </div>
          </div>
          <button
            type="button"
            class="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100"
            aria-label="Close"
            @click="close"
          >
            <X :size="20" />
          </button>
        </div>

        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div v-if="!isEdit && myEvents?.length">
            <label for="link-request" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-600">
              Link to completed event (optional)
            </label>
            <select
              id="link-request"
              v-model="linkedRequestId"
              class="input-dash w-full py-2 text-sm"
            >
              <option value="">None — announcement only (no feedback)</option>
              <option v-for="ev in postableEvents" :key="ev.id" :value="ev.id">
                {{ ev.name }} ({{ ev.date }})
              </option>
            </select>
            <p v-if="myEvents.length && !postableEvents.length" class="mt-1 text-xs text-amber-700">
              No completed events yet. You can still post announcements without linking an event.
            </p>
          </div>

          <div
            v-if="selectedLinkedEvent"
            class="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 text-sm text-gray-700"
          >
            <p class="font-semibold text-gray-900">{{ selectedLinkedEvent.name }}</p>
            <p class="mt-0.5">📅 {{ selectedLinkedEvent.date }} · {{ selectedLinkedEvent.startTime }} – {{ selectedLinkedEvent.endTime }}</p>
            <p>📍 {{ selectedLinkedEvent.venue }}</p>
            <p v-if="feedbackEnabled" class="mt-1 text-xs text-emerald-800">Student feedback will be enabled for this post.</p>
          </div>

          <div>
            <label for="post-event-title" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-600">
              Event title *
            </label>
            <input
              id="post-event-title"
              v-model="eventTitle"
              type="text"
              maxlength="200"
              placeholder="e.g. Technology and Innovation Seminar"
              class="input-dash w-full py-2.5 text-sm"
            />
          </div>

          <div v-if="!isEdit && feedbackEnabled" class="space-y-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
            <label class="flex cursor-pointer items-start gap-2 text-sm text-gray-800">
              <input v-model="requireFeedbackCode" type="checkbox" class="mt-0.5" />
              <span>
                <span class="font-semibold">Require access code for feedback</span>
                <span class="mt-0.5 block text-xs text-gray-500">Students must enter a code before submitting ratings.</span>
              </span>
            </label>
            <div v-if="requireFeedbackCode">
              <label for="feedback-access-code" class="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-600">
                Feedback access code
              </label>
              <input
                id="feedback-access-code"
                v-model="feedbackAccessCode"
                type="text"
                maxlength="64"
                autocomplete="off"
                placeholder="Share this code with attendees"
                class="input-dash w-full py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label for="student-post-caption" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-600">
              Caption *
            </label>
            <textarea
              id="student-post-caption"
              v-model="caption"
              rows="4"
              maxlength="2000"
              placeholder="Tell students about this event…"
              class="input-dash w-full resize-y py-2.5 text-sm"
            />
            <p class="mt-1 text-right text-xs text-gray-400">{{ caption.length }} / 2000</p>
          </div>

          <div>
            <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-600">
              Photo (optional)
            </label>
            <div v-if="imagePreviews.length" class="space-y-2">
              <div class="grid grid-cols-2 gap-2">
                <div
                  v-for="(preview, idx) in imagePreviews"
                  :key="preview"
                  class="relative overflow-hidden rounded-lg border border-gray-200"
                >
                  <img :src="preview" alt="Post preview" class="h-32 w-full object-cover" />
                  <div
                    v-if="uploadingImages"
                    class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/55 text-white"
                    aria-live="polite"
                  >
                    <Loader2 :size="22" class="animate-spin" />
                    <span class="text-[11px] font-semibold">Uploading…</span>
                  </div>
                  <button
                    v-else
                    type="button"
                    class="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                    aria-label="Remove image"
                    @click="removeImage(idx)"
                  >
                    <X :size="14" />
                  </button>
                </div>
              </div>
              <label
                class="inline-flex text-xs font-semibold"
                :class="publishing ? 'cursor-not-allowed text-gray-400' : 'cursor-pointer text-emerald-700 hover:underline'"
              >
                Replace photos…
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  class="sr-only"
                  :disabled="publishing"
                  @change="onImageChange"
                />
              </label>
            </div>
            <label
              v-else
              class="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 transition"
              :class="publishing ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-[#16A34A] hover:bg-green-50/50'"
            >
              <ImagePlus :size="28" class="text-gray-400" />
              <span class="text-sm font-medium text-gray-700">Add a photo</span>
              <span class="text-xs text-gray-500">JPEG, PNG, WebP, or GIF · up to 10 images · max 5 MB each</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                class="sr-only"
                :disabled="publishing"
                @change="onImageChange"
              />
            </label>
            <p v-if="imageError" class="mt-1 text-xs text-red-600">{{ imageError }}</p>
          </div>
        </div>

        <div class="flex gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4">
          <button
            type="button"
            class="flex-1 rounded-lg bg-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-300 disabled:opacity-60"
            :disabled="publishing"
            @click="close"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn-gradient flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm shadow disabled:opacity-60"
            :disabled="publishing || !caption.trim() || !eventTitle.trim()"
            @click="submit"
          >
            <Loader2 v-if="publishing" :size="16" class="animate-spin" />
            {{
              publishing
                ? isEdit
                  ? "Saving…"
                  : "Posting…"
                : isEdit
                  ? "Save changes"
                  : "Post to students"
            }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
