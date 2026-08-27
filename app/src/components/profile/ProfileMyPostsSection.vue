<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { MoreHorizontal } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { useEventRequestsStore } from "@/stores/eventRequests";
import { useUiStore } from "@/stores/ui";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { StudentEvent } from "@/views/student/types";
import { formatPostedAgo } from "@/views/student/orgColor";
import ProfileSectionCard from "@/components/profile/ProfileSectionCard.vue";
import DeletePostConfirmModal from "@/components/portal/DeletePostConfirmModal.vue";

const store = useEventRequestsStore();
const ui = useUiStore();
const { myFeedPosts } = storeToRefs(store);

const loading = ref(false);
const deleteTarget = ref<StudentEvent | null>(null);
const deleting = ref(false);
const openMenuId = ref<string | null>(null);

const posts = computed(() => myFeedPosts.value);

onMounted(async () => {
  document.addEventListener("click", closeMenus);
  if (!isSupabaseConfigured) return;
  loading.value = true;
  try {
    await store.loadMyFeedPosts(true);
  } catch (e) {
    ui.pushToast(
      "Could not load posts",
      e instanceof Error ? e.message : "Try again.",
      "error",
    );
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => document.removeEventListener("click", closeMenus));

function closeMenus() {
  openMenuId.value = null;
}

function toggleMenu(id: string, ev: MouseEvent) {
  ev.stopPropagation();
  openMenuId.value = openMenuId.value === id ? null : id;
}

function requestDelete(post: StudentEvent, ev: MouseEvent) {
  ev.stopPropagation();
  openMenuId.value = null;
  deleteTarget.value = post;
}

async function confirmDelete() {
  if (!deleteTarget.value || deleting.value) return;
  deleting.value = true;
  try {
    await store.deleteFeedPost(deleteTarget.value.id);
    deleteTarget.value = null;
    ui.pushToast("Post deleted successfully.", undefined, "success");
  } catch (e) {
    window.alert(e instanceof Error ? e.message : String(e));
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <ProfileSectionCard
    title="Your posts"
    description="Posts you shared to the student feed — manage them here like on your profile timeline."
  >
    <p v-if="loading" class="py-8 text-center text-sm text-slate-500">Loading your posts…</p>
    <p v-else-if="!posts.length" class="py-8 text-center text-sm text-slate-500">
      No posts yet. Use <strong>Create post</strong> on your dashboard to post to students.
    </p>

    <ul v-else class="space-y-3">
      <li
        v-for="post in posts"
        :key="post.id"
        class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        <div class="flex items-start gap-3 p-4 pb-2">
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-slate-900">{{ post.title }}</p>
            <p class="mt-0.5 text-xs text-slate-500">
              {{ formatPostedAgo(post.postedAt, post.day) }} · Public
            </p>
          </div>
          <div class="relative shrink-0" @click.stop>
            <button
              type="button"
              class="rounded-full p-2 text-slate-500 hover:bg-slate-100"
              aria-label="More options"
              @click="toggleMenu(post.id, $event)"
            >
              <MoreHorizontal class="h-5 w-5" />
            </button>
            <div
              v-if="openMenuId === post.id"
              class="absolute right-0 z-20 mt-1 min-w-[10rem] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
              role="menu"
            >
              <button
                type="button"
                class="block w-full px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                role="menuitem"
                @click="requestDelete(post, $event)"
              >
                Delete Post
              </button>
            </div>
          </div>
        </div>

        <div class="px-4 pb-3">
          <p v-if="post.caption" class="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
            {{ post.caption }}
          </p>
        </div>

        <div v-if="post.imageUrls?.length" class="border-y border-slate-100">
          <img
            :src="post.imageUrls[0]"
            :alt="post.title"
            class="max-h-56 w-full object-cover"
            loading="lazy"
          />
        </div>
        <div v-else-if="post.imageUrl" class="border-y border-slate-100">
          <img
            :src="post.imageUrl"
            :alt="post.title"
            class="max-h-56 w-full object-cover"
            loading="lazy"
          />
        </div>

        <div class="bg-slate-50/80 px-4 py-2.5 text-xs text-slate-600">
          <span v-if="post.date">📅 {{ post.date }}</span>
          <span v-if="post.time"> · {{ post.time }}</span>
          <span v-if="post.venue"> · 📍 {{ post.venue }}</span>
        </div>
      </li>
    </ul>

    <DeletePostConfirmModal
      :open="!!deleteTarget"
      :event-title="deleteTarget?.title"
      :deleting="deleting"
      @close="deleteTarget = null"
      @confirm="confirmDelete"
    />
  </ProfileSectionCard>
</template>
