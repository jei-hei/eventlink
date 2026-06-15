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

const loading = ref(false);
const error = ref<string | null>(null);
const rows = ref<EventFeedbackRow[]>([]);

const summary = computed(() => summarizeFeedback(rows.value));

const recent = computed(() => rows.value.slice(0, 8));

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
          <p class="text-gray-400 text-xs">On your campus feed posts</p>
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

    <p v-else-if="summary.total === 0" class="text-sm text-gray-500 py-6 text-center">
      No feedback yet. Students submit ratings from the event post on <strong>/student</strong>.
    </p>

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div class="rounded-lg bg-gray-50 border border-gray-100 p-3 text-center">
          <p class="text-2xl font-bold text-gray-900">{{ summary.total }}</p>
          <p class="text-xs text-gray-500">Total responses</p>
        </div>
        <div class="rounded-lg bg-yellow-50 border border-yellow-100 p-3 text-center">
          <p class="text-2xl font-bold text-gray-900 flex items-center justify-center gap-1">
            {{ summary.averageRating.toFixed(1) }}
            <Star :size="20" class="fill-yellow-400 text-yellow-400" />
          </p>
          <p class="text-xs text-gray-500">Average rating</p>
        </div>
        <div class="rounded-lg bg-green-50 border border-green-100 p-3 text-center">
          <p class="text-2xl font-bold text-gray-900">{{ summary.byPost.length }}</p>
          <p class="text-xs text-gray-500">Events with feedback</p>
        </div>
      </div>

      <ul class="space-y-2 max-h-72 overflow-y-auto">
        <li
          v-for="item in recent"
          :key="item.id"
          class="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2.5"
        >
          <div class="flex items-start justify-between gap-2">
            <p class="text-sm font-semibold text-gray-800 truncate">
              {{ item.student_feed_posts?.event_title ?? "Event" }}
            </p>
            <span class="shrink-0 flex items-center gap-0.5 text-xs font-bold text-yellow-600">
              {{ item.rating }}
              <Star :size="12" class="fill-yellow-400 text-yellow-400" />
            </span>
          </div>
          <p class="text-xs text-gray-600 mt-1 line-clamp-2">{{ item.comment }}</p>
          <p class="text-[10px] text-gray-400 mt-1">{{ formatDate(item.created_at) }}</p>
        </li>
      </ul>
    </template>
  </div>
</template>
