<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useDebouncedRef } from "@/composables/useDebounce";
import { RefreshCw, Search, User } from "lucide-vue-next";
import { RouterLink } from "vue-router";
import type { StudentEvent } from "./types";
import { studentEvents } from "./eventData";
import EventCard from "./components/EventCard.vue";
import PortalFeedSkeleton from "@/components/portal/PortalFeedSkeleton.vue";
import EventModal from "./components/EventModal.vue";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useEventRequestsStore } from "@/stores/eventRequests";
import { useAuthStore } from "@/stores/auth";
import { useProfileStore } from "@/stores/profile";

const auth = useAuthStore();
const profile = useProfileStore();

const ALL_ORGANIZATIONS = "All Organizations";
const ALL_VENUES = "All Venues";
/** Original design: default "Gymnasium" means show every venue until user picks a specific one. */
const VENUE_SHOW_ALL = "Gymnasium";

const searchQuery = ref("");
const debouncedSearch = useDebouncedRef(searchQuery, 280);
const selectedOrg = ref(ALL_ORGANIZATIONS);
const selectedTime = ref("This Week");
const selectedVenue = ref(VENUE_SHOW_ALL);
const selectedSort = ref("Newest");
const selectedEvent = ref<StudentEvent | null>(null);
const previewImage = ref<{ images: string[]; index: number; title: string } | null>(null);

function openImagePreview(images: string[], index: number, title: string) {
  if (!images.length) return;
  const safeIndex = Math.min(Math.max(0, index), images.length - 1);
  previewImage.value = { images, index: safeIndex, title };
}

function previousPreviewImage() {
  if (!previewImage.value || previewImage.value.index <= 0) return;
  previewImage.value = {
    ...previewImage.value,
    index: previewImage.value.index - 1,
  };
}

function nextPreviewImage() {
  if (!previewImage.value || previewImage.value.index >= previewImage.value.images.length - 1) return;
  previewImage.value = {
    ...previewImage.value,
    index: previewImage.value.index + 1,
  };
}


const eventStore = useEventRequestsStore();

const useLiveFeed = computed(() => isSupabaseConfigured);

onMounted(() => {
  if (useLiveFeed.value) void loadFeed();
  if (auth.isAuthenticated && auth.appRole === "student") {
    void profile.ensureHydrated("student");
  }
});

const profileLinkTo = computed(() =>
  auth.isAuthenticated && auth.appRole === "student" ? "/student/profile" : "/login",
);

const profileLinkLabel = computed(() => {
  if (!auth.isAuthenticated || auth.appRole !== "student") {
    return "Sign in";
  }
  const name = profile.displayName?.trim();
  if (name && name !== "Guest") return name;
  const fromAuth = auth.displayName?.trim();
  if (fromAuth) return fromAuth;
  return "My profile";
});

async function loadFeed() {
  try {
    await eventStore.loadForStudentDashboard(true);
  } catch {
    /* feedError set in store */
  }
}

async function loadMoreFeed() {
  try {
    await eventStore.loadMoreForStudentDashboard();
  } catch {
    /* feedError set in store */
  }
}

const displayEvents = computed(() =>
  useLiveFeed.value && eventStore.studentBoardLoaded
    ? eventStore.studentFeedEvents
    : useLiveFeed.value
      ? []
      : studentEvents,
);

const organizationOptions = computed(() => {
  const names = new Set(displayEvents.value.map((e) => e.organization).filter(Boolean));
  return [ALL_ORGANIZATIONS, ...Array.from(names).sort()];
});

const venueOptions = computed(() => {
  const names = new Set(displayEvents.value.map((e) => e.venue).filter(Boolean));
  return [VENUE_SHOW_ALL, ALL_VENUES, ...Array.from(names).sort()];
});

function eventTimestamp(event: StudentEvent): number {
  if (event.postedAt) return new Date(event.postedAt).getTime();
  const d = new Date();
  if (event.day >= 1 && event.day <= 31) d.setDate(event.day);
  return d.getTime();
}

function matchesTimeFilter(event: StudentEvent, filter: string): boolean {
  if (filter === "All Time") return true;
  const when = event.postedAt ? new Date(event.postedAt) : new Date(eventTimestamp(event));
  const now = new Date();
  if (filter === "Today") {
    return when.toDateString() === now.toDateString();
  }
  if (filter === "This Week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return when >= start && when < end;
  }
  if (filter === "This Month") {
    return when.getMonth() === now.getMonth() && when.getFullYear() === now.getFullYear();
  }
  return true;
}

function matchesVenueFilter(event: StudentEvent, venue: string): boolean {
  if (venue === ALL_VENUES || venue === VENUE_SHOW_ALL) return true;
  return event.venue === venue;
}

const filteredEvents = computed(() => {
  const q = debouncedSearch.value.toLowerCase().trim();
  let list = displayEvents.value.filter((event) => {
    if (selectedOrg.value !== ALL_ORGANIZATIONS && event.organization !== selectedOrg.value) {
      return false;
    }
    if (!matchesTimeFilter(event, selectedTime.value)) return false;
    if (!matchesVenueFilter(event, selectedVenue.value)) return false;
    if (!q) return true;
    return (
      event.title.toLowerCase().includes(q) ||
      event.posterName.toLowerCase().includes(q) ||
      event.organization.toLowerCase().includes(q) ||
      event.posterCollege.toLowerCase().includes(q) ||
      event.venue.toLowerCase().includes(q) ||
      (event.caption?.toLowerCase().includes(q) ?? false)
    );
  });

  if (selectedSort.value === "Oldest") {
    list = [...list].sort((a, b) => eventTimestamp(a) - eventTimestamp(b));
  } else if (selectedSort.value === "Date") {
    list = [...list].sort((a, b) => a.title.localeCompare(b.title));
  } else {
    list = [...list].sort((a, b) => eventTimestamp(b) - eventTimestamp(a));
  }
  return list;
});
</script>

<template>
  <div class="portal-root flex min-h-dvh flex-col">
    <header class="portal-topbar shrink-0">
      <div class="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-3 py-2 sm:flex-row sm:items-center sm:gap-4 sm:px-4">
        <RouterLink
          :to="profileLinkTo"
          class="portal-topbar-btn inline-flex max-w-[min(100%,14rem)] w-fit shrink-0 items-center gap-2 px-1 py-1 sm:max-w-xs sm:px-2"
          :title="auth.isAuthenticated ? 'My profile' : 'Sign in to your account'"
        >
          <User class="h-5 w-5 shrink-0 text-white/90" aria-hidden="true" />
          <span class="truncate text-sm font-medium">{{ profileLinkLabel }}</span>
        </RouterLink>

        <div class="relative min-w-0 flex-1">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Search posts, organizations, venues…"
            class="input-dash w-full py-2.5 pl-10 pr-3"
            autocomplete="off"
          />
        </div>

        <RouterLink
          v-if="auth.isAuthenticated && auth.appRole === 'student'"
          to="/student/monitoring"
          class="portal-topbar-btn inline-flex shrink-0 items-center gap-2 px-3 py-2 text-sm"
        >
          Event Monitoring
        </RouterLink>
        <button
          v-if="useLiveFeed"
          type="button"
          class="portal-topbar-btn inline-flex shrink-0 items-center gap-2 px-3 py-2 text-sm disabled:opacity-60"
          :disabled="eventStore.feedLoading"
          @click="loadFeed"
        >
          <RefreshCw :size="16" :class="{ 'animate-spin': eventStore.feedLoading }" />
          Refresh
        </button>
      </div>
    </header>

    <main class="mx-auto w-full max-w-[1400px] flex-1 px-3 py-4 sm:px-4">
      <h1 class="mb-1 text-lg font-bold text-slate-900 sm:text-xl">Campus feed</h1>
      <p class="mb-3 text-sm text-slate-600">
        Posts from student organizations and SSC — captions and photos about campus events.
      </p>

      <div
        class="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4 md:gap-4"
        role="group"
        aria-label="Filter campus feed"
      >
        <div class="min-w-0 rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-900/[0.02] sm:p-4">
          <label class="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Organization</label>
          <select v-model="selectedOrg" class="input-dash w-full py-2.5 text-sm">
            <option v-for="org in organizationOptions" :key="org" :value="org">{{ org }}</option>
          </select>
        </div>
        <div class="min-w-0 rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-900/[0.02] sm:p-4">
          <label class="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Time</label>
          <select v-model="selectedTime" class="input-dash w-full py-2.5 text-sm">
            <option value="This Week">This Week</option>
            <option value="Today">Today</option>
            <option value="This Month">This Month</option>
            <option value="All Time">All Time</option>
          </select>
        </div>
        <div class="min-w-0 rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-900/[0.02] sm:p-4">
          <label class="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Venue</label>
          <select v-model="selectedVenue" class="input-dash w-full py-2.5 text-sm">
            <option v-for="venue in venueOptions" :key="venue" :value="venue">{{ venue }}</option>
          </select>
        </div>
        <div class="min-w-0 rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-900/[0.02] sm:p-4">
          <label class="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Sort</label>
          <select v-model="selectedSort" class="input-dash w-full py-2.5 text-sm">
            <option value="Newest">Newest</option>
            <option value="Oldest">Oldest</option>
            <option value="Date">Date (A–Z)</option>
          </select>
        </div>
      </div>

      <p v-if="eventStore.feedError" class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        Could not load posts: {{ eventStore.feedError }}.
        <span v-if="eventStore.feedError.includes('student_feed_posts')">
          Run migration <code class="text-xs">20260528900000_student_feed_posts.sql</code> and
          <code class="text-xs">20260529000000_student_feed_public_read.sql</code> in Supabase.
        </span>
      </p>

      <PortalFeedSkeleton
        v-if="eventStore.feedLoading && !eventStore.studentBoardLoaded"
        :cards="3"
      />

      <div
        v-else-if="!eventStore.feedLoading && filteredEvents.length === 0"
        class="py-16 text-center text-slate-500 text-sm"
      >
        <template v-if="useLiveFeed">
          No posts yet. <strong>Student officers</strong> and <strong>SSC</strong> can click
          <strong>Create post</strong> on their dashboard.
        </template>
        <template v-else>Connect Supabase to show live campus posts.</template>
      </div>

      <div v-else class="mx-auto flex max-w-xl flex-col gap-4">
        <EventCard
          v-for="event in filteredEvents"
          :key="event.id"
          :event="event"
          @select="selectedEvent = event"
          @preview-image="openImagePreview"
        />
        <button
          v-if="useLiveFeed && eventStore.studentFeedHasMore && !searchQuery.trim() && selectedOrg === ALL_ORGANIZATIONS"
          type="button"
          class="portal-btn-secondary mt-2 w-full py-2.5"
          :disabled="eventStore.feedLoading"
          @click="loadMoreFeed"
        >
          {{ eventStore.feedLoading ? "Loading…" : "Load more posts" }}
        </button>
      </div>
    </main>

    <EventModal
      v-if="selectedEvent"
      :event="selectedEvent"
      @close="selectedEvent = null"
      @preview-image="openImagePreview"
    />

    <div
      v-if="previewImage"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      @click.self="previewImage = null"
    >
      <button
        type="button"
        class="absolute right-4 top-4 rounded-full bg-black/60 px-3 py-1 text-2xl text-white hover:bg-black/75"
        aria-label="Close image preview"
        @click="previewImage = null"
      >
        ×
      </button>
      <img
        :src="previewImage.images[previewImage.index]"
        :alt="previewImage.title"
        class="max-h-[90vh] max-w-[95vw] rounded-lg object-contain shadow-2xl"
      />
      <button
        v-if="previewImage.index > 0"
        type="button"
        class="absolute left-4 rounded-full bg-black/60 px-4 py-2 text-2xl text-white hover:bg-black/75"
        aria-label="Previous image"
        @click.stop="previousPreviewImage"
      >
        ‹
      </button>
      <button
        v-if="previewImage.index < previewImage.images.length - 1"
        type="button"
        class="absolute right-16 rounded-full bg-black/60 px-4 py-2 text-2xl text-white hover:bg-black/75"
        aria-label="Next image"
        @click.stop="nextPreviewImage"
      >
        ›
      </button>
      <p class="absolute bottom-4 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
        {{ previewImage.index + 1 }} / {{ previewImage.images.length }}
      </p>
    </div>
  </div>
</template>
