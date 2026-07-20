<script setup lang="ts">
import { ref, watch } from "vue";
import { ImagePlus, Loader2, Megaphone, X } from "lucide-vue-next";
import type { PortalEvent } from "@/types/portalEvent";
import type { CreateStudentFeedPostInput } from "@/types/studentPost";
import { isPostImageFile } from "@/services/eventPostImageStorage";

const props = defineProps<{
  open: boolean;
  myEvents?: PortalEvent[];
  publishing?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  publish: [payload: CreateStudentFeedPostInput];
}>();

const caption = ref("");
const eventTitle = ref("");
const eventDate = ref("");
const eventTime = ref("");
const venue = ref("");
const linkedRequestId = ref("");
const imageFile = ref<File | null>(null);
const imageFiles = ref<File[]>([]);
const imagePreviews = ref<string[]>([]);
const imageError = ref("");

function reset() {
  caption.value = "";
  eventTitle.value = "";
  eventDate.value = "";
  eventTime.value = "";
  venue.value = "";
  linkedRequestId.value = "";
  imageFile.value = null;
  imageFiles.value = [];
  imagePreviews.value.forEach((url) => URL.revokeObjectURL(url));
  imagePreviews.value = [];
  imageError.value = "";
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) reset();
  },
);

function close() {
  reset();
  emit("close");
}

function applyLinkedEvent() {
  const id = linkedRequestId.value;
  if (!id) return;
  const ev = props.myEvents?.find((e) => e.id === id);
  if (!ev) return;
  eventTitle.value = ev.name;
  eventDate.value = ev.date ?? "";
  eventTime.value = [ev.startTime, ev.endTime].filter(Boolean).join(" – ");
  venue.value = ev.venue ?? "";
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
  imagePreviews.value.forEach((url) => URL.revokeObjectURL(url));
  imageFile.value = valid[0] ?? null;
  imageFiles.value = valid;
  imagePreviews.value = valid.map((file) => URL.createObjectURL(file));
}

function removeImage(index: number) {
  if (index < 0 || index >= imageFiles.value.length) return;
  const nextFiles = [...imageFiles.value];
  const nextPreviews = [...imagePreviews.value];
  const [removedPreview] = nextPreviews.splice(index, 1);
  nextFiles.splice(index, 1);
  if (removedPreview) URL.revokeObjectURL(removedPreview);
  imageFiles.value = nextFiles;
  imagePreviews.value = nextPreviews;
  imageFile.value = null;
  imageFile.value = imageFiles.value[0] ?? null;
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
  emit("publish", {
    caption: text,
    eventTitle: title,
    eventDate: eventDate.value.trim() || undefined,
    eventTime: eventTime.value.trim() || undefined,
    venue: venue.value.trim() || undefined,
    requestId: linkedRequestId.value || null,
    imageFile: imageFile.value,
    imageFiles: imageFiles.value,
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
              <h2 id="create-student-post-title" class="text-base font-bold text-gray-900">Create post</h2>
              <p class="text-xs text-gray-500">Caption and optional photo for the student feed</p>
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
          <div v-if="myEvents?.length">
            <label for="link-request" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-600">
              Link to your event request (optional)
            </label>
            <select
              id="link-request"
              v-model="linkedRequestId"
              class="input-dash w-full py-2 text-sm"
              @change="applyLinkedEvent"
            >
              <option value="">None — type details below</option>
              <option v-for="ev in myEvents" :key="ev.id" :value="ev.id">
                {{ ev.name }} ({{ ev.date }})
              </option>
            </select>
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

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label for="post-event-date" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-600">
                Date
              </label>
              <input
                id="post-event-date"
                v-model="eventDate"
                type="text"
                placeholder="Mar 21, 2026"
                class="input-dash w-full py-2.5 text-sm"
              />
            </div>
            <div>
              <label for="post-event-time" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-600">
                Time
              </label>
              <input
                id="post-event-time"
                v-model="eventTime"
                type="text"
                placeholder="2:00 PM – 5:00 PM"
                class="input-dash w-full py-2.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label for="post-venue" class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-600">
              Venue
            </label>
            <input
              id="post-venue"
              v-model="venue"
              type="text"
              placeholder="Gymnasium"
              class="input-dash w-full py-2.5 text-sm"
            />
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
            <div v-if="imagePreviews.length" class="grid grid-cols-2 gap-2">
              <div
                v-for="(preview, idx) in imagePreviews"
                :key="preview"
                class="relative overflow-hidden rounded-lg border border-gray-200"
              >
                <img :src="preview" alt="Post preview" class="h-32 w-full object-cover" />
                <button
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
              v-else
              class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 transition hover:border-[#16A34A] hover:bg-green-50/50"
            >
              <ImagePlus :size="28" class="text-gray-400" />
              <span class="text-sm font-medium text-gray-700">Add a photo</span>
              <span class="text-xs text-gray-500">JPEG, PNG, WebP, or GIF · up to 10 images · max 5 MB each</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                class="sr-only"
                @change="onImageChange"
              />
            </label>
            <p v-if="imageError" class="mt-1 text-xs text-red-600">{{ imageError }}</p>
          </div>
        </div>

        <div class="flex gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4">
          <button
            type="button"
            class="flex-1 rounded-lg bg-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-300"
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
            {{ publishing ? "Posting…" : "Post to students" }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
