import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  approveEventRequest,
  createEventRequest,
  declineEventRequest,
  fetchAllEventRequests,
  fetchHistoryForRequest,
  filterApprovedForRole,
  filterCalendarEvents,
  filterDeclinedForRole,
  filterPendingForRole,
  filterPostedEvents,
  mapRowToPortalEvent,
  postEventToStaffCalendar,
  resubmitDeclinedEventRequest,
  updateEventRequest,
} from "@/services/eventRequestsDb";
import type { UpdateEventRequestInput } from "@/services/eventRequestsDb";
import type { CreateEventRequestInput } from "@/types/eventRequest";
import {
  createStudentFeedPost,
  fetchStudentFeedPostsPage,
  fetchFeedPostsBySubmitter,
  mapFeedPostToStudentEvent,
} from "@/services/studentFeedPostsDb";
import type { CreateStudentFeedPostInput, StudentFeedPostRow } from "@/types/studentPost";
import type { StudentEvent } from "@/views/student/types";
import type { EventRequestRow } from "@/types/eventRequest";
import type { PortalEvent } from "@/types/portalEvent";
import type { AppRole } from "@/types/appRole";
import { useAuthStore } from "@/stores/auth";

export const useEventRequestsStore = defineStore("eventRequests", () => {
  const rows = ref<EventRequestRow[]>([]);
  const loading = ref(false);
  const feedLoading = ref(false);
  const error = ref<string | null>(null);
  const feedError = ref<string | null>(null);
  const loaded = ref(false);
  const studentBoardLoaded = ref(false);
  const studentFeedOffset = ref(0);
  const studentFeedHasMore = ref(false);
  const feedPostRows = ref<StudentFeedPostRow[]>([]);
  const myFeedPostRows = ref<StudentFeedPostRow[]>([]);

  const postedRows = computed(() => filterPostedEvents(rows.value));

  const postedEvents = computed<PortalEvent[]>(() =>
    postedRows.value.map((r) => mapRowToPortalEvent(r)),
  );

  const scheduledEvents = computed<PortalEvent[]>(() =>
    filterCalendarEvents(rows.value).map((r) => mapRowToPortalEvent(r)),
  );

  async function withRetry<T>(task: () => Promise<T>, retries = 2): Promise<T> {
    let lastErr: unknown = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await task();
      } catch (e) {
        lastErr = e;
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
        }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  async function load(force = false) {
    if (!isSupabaseConfigured) return;
    if (loaded.value && !force) return;
    loading.value = true;
    error.value = null;
    try {
      rows.value = await withRetry(() => fetchAllEventRequests(), 2);
      loaded.value = true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  const studentFeedEvents = computed<StudentEvent[]>(() =>
    feedPostRows.value.map((r) => mapFeedPostToStudentEvent(r)),
  );

  const myFeedPosts = computed<StudentEvent[]>(() =>
    myFeedPostRows.value.map((r) => mapFeedPostToStudentEvent(r)),
  );

  /** Load campus feed for /student (no staff auth required). */
  async function loadForStudentDashboard(force = false) {
    if (!isSupabaseConfigured) return;
    if (studentBoardLoaded.value && !force) return;
    feedLoading.value = true;
    feedError.value = null;
    try {
      const page = await withRetry(() => fetchStudentFeedPostsPage(0, 20), 2);
      feedPostRows.value = page.rows;
      studentFeedOffset.value = page.nextOffset;
      studentFeedHasMore.value = page.hasMore;
      studentBoardLoaded.value = true;
    } catch (e) {
      feedError.value = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      feedLoading.value = false;
    }
  }

  async function loadMoreForStudentDashboard() {
    if (!isSupabaseConfigured || feedLoading.value || !studentFeedHasMore.value) return;
    feedLoading.value = true;
    feedError.value = null;
    try {
      const page = await fetchStudentFeedPostsPage(studentFeedOffset.value, 20);
      const existing = new Set(feedPostRows.value.map((r) => r.id));
      const merged = [...feedPostRows.value];
      for (const row of page.rows) {
        if (!existing.has(row.id)) merged.push(row);
      }
      feedPostRows.value = merged;
      studentFeedOffset.value = page.nextOffset;
      studentFeedHasMore.value = page.hasMore;
      studentBoardLoaded.value = true;
    } catch (e) {
      feedError.value = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      feedLoading.value = false;
    }
  }

  async function loadMyFeedPosts(force = false) {
    const auth = useAuthStore();
    if (!isSupabaseConfigured || !auth.userId) return;
    if (myFeedPostRows.value.length && !force) return;
    myFeedPostRows.value = await fetchFeedPostsBySubmitter(auth.userId);
  }

  function prependFeedPost(row: StudentFeedPostRow) {
    const without = feedPostRows.value.filter((r) => r.id !== row.id);
    feedPostRows.value = [row, ...without];
    studentBoardLoaded.value = true;
    studentFeedOffset.value += 1;

    const auth = useAuthStore();
    if (auth.userId && row.submitted_by === auth.userId) {
      const myWithout = myFeedPostRows.value.filter((r) => r.id !== row.id);
      myFeedPostRows.value = [row, ...myWithout];
    }
  }

  async function createFeedPost(input: CreateStudentFeedPostInput) {
    const auth = useAuthStore();
    if (!auth.userId || !auth.appRole) throw new Error("You must be signed in.");
    const row = await createStudentFeedPost(input, auth.userId, auth.appRole);
    prependFeedPost(row);
    void loadForStudentDashboard(true).catch(() => undefined);
    void loadMyFeedPosts(true).catch(() => undefined);
    return row;
  }

  function pendingForRole(role: AppRole, userId: string): PortalEvent[] {
    const auth = useAuthStore();
    return filterPendingForRole(rows.value, role, userId, {
      collegeId: auth.collegeId,
      organizationId: auth.organizationId,
    }).map((r) => mapRowToPortalEvent(r));
  }

  function approvedForRole(role: AppRole, userId: string): PortalEvent[] {
    return filterApprovedForRole(rows.value, role, userId).map((r) => mapRowToPortalEvent(r));
  }

  function declinedForRole(role: AppRole, userId: string): PortalEvent[] {
    return filterDeclinedForRole(rows.value, role, userId).map((r) => mapRowToPortalEvent(r));
  }

  async function submit(input: CreateEventRequestInput) {
    const auth = useAuthStore();
    if (!auth.userId) throw new Error("You must be signed in.");
    await createEventRequest(input, auth.userId);
    await load(true);
  }

  async function approve(id: string) {
    const auth = useAuthStore();
    if (!auth.userId || !auth.appRole) throw new Error("You must be signed in.");
    await approveEventRequest(id, auth.userId, auth.appRole);
    await load(true);
  }

  async function decline(id: string, reason = "Declined") {
    const auth = useAuthStore();
    if (!auth.userId || !auth.appRole) throw new Error("You must be signed in.");
    await declineEventRequest(id, auth.userId, auth.appRole, reason);
    await load(true);
  }

  async function postToCalendar(id: string) {
    const auth = useAuthStore();
    if (!auth.userId) throw new Error("You must be signed in.");
    await postEventToStaffCalendar(id, auth.userId);
    await load(true);
  }

  async function update(id: string, input: UpdateEventRequestInput) {
    const auth = useAuthStore();
    if (!auth.userId) throw new Error("You must be signed in.");
    await updateEventRequest(id, input, auth.userId);
    await load(true);
  }

  async function resubmitDeclined(id: string, input: UpdateEventRequestInput) {
    const auth = useAuthStore();
    if (!auth.userId || !auth.appRole) throw new Error("You must be signed in.");
    if (auth.appRole !== "student_officer" && auth.appRole !== "ssc") {
      throw new Error("Only Student Officer or SSC can resubmit declined requests.");
    }
    await resubmitDeclinedEventRequest(id, input, auth.userId, auth.appRole);
    await load(true);
  }

  async function getPortalEvent(id: string): Promise<PortalEvent | null> {
    const row = rows.value.find((r) => r.id === id);
    if (!row) return null;
    const history = await fetchHistoryForRequest(id);
    return mapRowToPortalEvent(row, history);
  }

  return {
    rows,
    loading,
    feedLoading,
    error,
    feedError,
    loaded,
    postedEvents,
    studentFeedEvents,
    myFeedPosts,
    studentFeedHasMore,
    scheduledEvents,
    load,
    loadForStudentDashboard,
    loadMoreForStudentDashboard,
    loadMyFeedPosts,
    createFeedPost,
    studentBoardLoaded,
    pendingForRole,
    approvedForRole,
    declinedForRole,
    submit,
    approve,
    decline,
    postToCalendar,
    update,
    resubmitDeclined,
    getPortalEvent,
  };
});
