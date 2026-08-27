<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { MessageSquare, Star } from "lucide-vue-next";
import { useAuthStore } from "@/stores/auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  fetchFeedbackForSubmitter,
  summarizeFeedback,
} from "@/services/eventFeedbackDb";
import type { EventFeedbackRow } from "@/types/eventFeedback";
import EventFeedbackModal from "@/components/portal/EventFeedbackModal.vue";

const loading = ref(false);
const error = ref<string | null>(null);
const rows = ref<EventFeedbackRow[]>([]);
const selectedPostId = ref<string | null>(null);

const summary = computed(() => summarizeFeedback(rows.value));

const selectedMeta = computed(() => {
  if (!selectedPostId.value) return null;
  const match = summary.value.byPost.find((p) => p.feedPostId === selectedPostId.value);
  const sample = rows.value.find((r) => r.feed_post_id === selectedPostId.value);
  return {
    feedPostId: selectedPostId.value,
    eventTitle: match?.eventTitle ?? sample?.student_feed_posts?.event_title ?? "Event",
  };
});

onMounted(() => {
  void load();
});

async function load() {
  const auth = useAuthStore();
  if (!isSupabaseConfigured || !auth.userId) return;
  loading.value = true;
  error.value = null;
  try {
    rows.value = await fetchFeedbackForSubmitter(auth.userId);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
    <div class="flex items-center justify-between gap-3 mb-4 flex-wrap">
      <div class="flex items-center gap-2">
        <div class="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
          <MessageSquare :size="18" class="text-emerald-700" />
        </div>
        <div>
          <h3 class="font-bold text-gray-800 text-sm">Student feedback</h3>
          <p class="text-gray-400 text-xs">Open an event to view its feedback only</p>
        </div>
      </div>
      <button
        type="button"
        class="text-xs font-semibold text-[#16A34A] hover:underline disabled:opacity-50"
        :disabled="loading"
        @click="load"
      >
        Refresh
      </button>
    </div>

    <p v-if="loading" class="text-sm text-gray-500 py-6 text-center">Loading feedback…</p>

    <p v-else-if="error" class="text-sm text-red-600 py-4">
      {{ error }}
      <span v-if="error.includes('event_feedback')">
        Run <code class="text-xs">20260529100000_feedback_feed_posts.sql</code>.
      </span>
    </p>

    <p v-else-if="summary.byPost.length === 0" class="text-sm text-gray-500 py-6 text-center">
      No feedback yet. Students submit ratings from the event post on <strong>/student</strong>.
    </p>

    <ul v-else class="space-y-2 max-h-80 overflow-y-auto">
      <li
        v-for="item in summary.byPost"
        :key="item.feedPostId"
        class="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2.5"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-gray-800 truncate">{{ item.eventTitle }}</p>
            <p class="mt-0.5 text-xs text-gray-500">
              {{ item.count }} response{{ item.count === 1 ? "" : "s" }} · avg
              {{ item.averageRating.toFixed(1) }}
              <Star :size="11" class="inline fill-yellow-400 text-yellow-400" />
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
            @click="selectedPostId = item.feedPostId"
          >
            View Feedback
          </button>
        </div>
      </li>
    </ul>

    <EventFeedbackModal
      :open="!!selectedPostId"
      :event-title="selectedMeta?.eventTitle ?? 'Event'"
      :feed-post-id="selectedPostId"
      @close="selectedPostId = null"
    />
  </div>
</template>
