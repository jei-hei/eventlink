<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Star, X } from "lucide-vue-next";
import {
  fetchFeedbackForFeedPost,
  fetchFeedbackForRequest,
  summarizeFeedback,
} from "@/services/eventFeedbackDb";
import type { EventFeedbackRow } from "@/types/eventFeedback";
import { isSupabaseConfigured } from "@/lib/supabase";

const props = defineProps<{
  open: boolean;
  eventTitle: string;
  eventDate?: string;
  eventTime?: string;
  venue?: string;
  organization?: string;
  feedPostId?: string | null;
  requestId?: string | null;
}>();

const emit = defineEmits<{ close: [] }>();

const loading = ref(false);
const error = ref<string | null>(null);
const rows = ref<EventFeedbackRow[]>([]);

const summary = computed(() => summarizeFeedback(rows.value));

watch(
  () => [props.open, props.feedPostId, props.requestId] as const,
  ([open]) => {
    if (open) void load();
  },
);

async function load() {
  if (!isSupabaseConfigured) {
    rows.value = [];
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    if (props.feedPostId) {
      rows.value = await fetchFeedbackForFeedPost(props.feedPostId);
    } else if (props.requestId) {
      rows.value = await fetchFeedbackForRequest(props.requestId);
    } else {
      rows.value = [];
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function stars(n: number) {
  return "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
    @click.self="emit('close')"
  >
    <div class="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
      <div class="flex items-center justify-between bg-emerald-600 px-5 py-3 text-white">
        <h3 class="text-sm font-bold">Event Feedback</h3>
        <button type="button" class="rounded p-1 hover:bg-emerald-700" @click="emit('close')">
          <X :size="16" />
        </button>
      </div>

      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <p class="font-semibold text-slate-900">{{ eventTitle }}</p>
          <p v-if="organization" class="mt-1 text-slate-600">{{ organization }}</p>
          <p class="mt-1 text-slate-600">
            <span v-if="eventDate">{{ eventDate }}</span>
            <span v-if="eventTime"> · {{ eventTime }}</span>
          </p>
          <p v-if="venue" class="text-slate-600">{{ venue }}</p>
        </div>

        <p v-if="loading" class="py-8 text-center text-sm text-slate-500">Loading feedback…</p>
        <p v-else-if="error" class="py-4 text-sm text-red-600">{{ error }}</p>
        <p v-else-if="summary.total === 0" class="py-8 text-center text-sm text-slate-500">
          No student feedback for this event yet.
        </p>

        <template v-else>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div class="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
              <p class="text-2xl font-bold text-gray-900">{{ summary.total }}</p>
              <p class="text-xs text-gray-500">Total responses</p>
            </div>
            <div class="rounded-lg border border-yellow-100 bg-yellow-50 p-3 text-center">
              <p class="flex items-center justify-center gap-1 text-2xl font-bold text-gray-900">
                {{ summary.averageRating.toFixed(1) }}
                <Star :size="18" class="fill-yellow-400 text-yellow-400" />
              </p>
              <p class="text-xs text-gray-500">Average / 5</p>
            </div>
            <div class="col-span-2 rounded-lg border border-gray-100 bg-white p-3 text-xs text-slate-600 sm:col-span-1">
              <p v-for="n in [5, 4, 3, 2, 1]" :key="n" class="flex justify-between gap-2">
                <span>{{ n }} Stars</span>
                <span class="font-semibold">{{ summary.ratingCounts[n as 1 | 2 | 3 | 4 | 5] }}</span>
              </p>
            </div>
          </div>

          <div>
            <p class="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Student Feedback</p>
            <ul class="space-y-3">
              <li
                v-for="item in rows"
                :key="item.id"
                class="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2.5"
              >
                <p class="text-sm font-semibold tracking-wide text-yellow-600">{{ stars(item.rating) }}</p>
                <p class="mt-1 text-sm text-gray-800">"{{ item.comment }}"</p>
                <p class="mt-2 text-xs text-gray-500">Student · {{ formatDate(item.created_at) }}</p>
              </li>
            </ul>
          </div>
        </template>
      </div>

      <div class="border-t border-gray-200 bg-gray-50 px-5 py-3 text-right">
        <button
          type="button"
          class="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
          @click="emit('close')"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>
