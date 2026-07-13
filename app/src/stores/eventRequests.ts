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
  filterPendingForRole,
  filterPostedEvents,
  mapRowToPortalEvent,
  postEventToStaffCalendar,
  updateEventRequest,
} from "@/services/eventRequestsDb";
import type { UpdateEventRequestInput } from "@/services/eventRequestsDb";
import type { CreateEventRequestInput } from "@/types/eventRequest";
import {
  createStudentFeedPost,
  fetchFeedPostsBySubmitter,
  fetchStudentFeedPosts,
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
  const feedPostRows = ref<StudentFeedPostRow[]>([]);
  const myFeedPostRows = ref<StudentFeedPostRow[]>([]);

  const postedRows = computed(() => filterPostedEvents(rows.value));

  const postedEvents = computed<PortalEvent[]>(() =>
    postedRows.value.map((r) => mapRowToPortalEvent(r)),
  );

  const scheduledEvents = computed<PortalEvent[]>(() =>
    filterCalendarEvents(rows.value).map((r) => mapRowToPortalEvent(r)),
  );

  async function load(force = false) {
    if (!isSupabaseConfigured) return;
    if (loaded.value && !force) return;
    loading.value = true;
    error.value = null;
    try {
      rows.value = await fetchAllEventRequests();
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
      feedPostRows.value = await fetchStudentFeedPosts();
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
    scheduledEvents,
    load,
    loadForStudentDashboard,
    loadMyFeedPosts,
    createFeedPost,
    studentBoardLoaded,
    pendingForRole,
    approvedForRole,
    submit,
    approve,
    decline,
    postToCalendar,
    update,
    getPortalEvent,
  };
});
