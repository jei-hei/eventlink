import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  approveEventRequest,
  createEventRequest,
  declineEventRequest,
  fetchPortalEventRequestsForRole,
  fetchHistoryForRequest,
  filterApprovedForRole,
  filterCalendarEvents,
  filterDeclinedForRole,
  filterMonitoringForRole,
  filterPendingForRole,
  filterPostedEvents,
  mapRowToPortalEvent,
  postEventToStaffCalendar,
  resubmitDeclinedEventRequest,
  updateEventRequest,
  cancelScheduledEventRequest,
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
  const lastLoadedAt = ref(0);
  const loadScopeKey = ref("");
  /** Soft cache for background polls; mutations and long tab-hide still force. */
  const STALE_MS = 45_000;
  let inFlight: { scope: string; force: boolean; promise: Promise<boolean> } | null = null;
  const portalById = ref<Map<string, PortalEvent>>(new Map());

  function currentScopeKey() {
    const auth = useAuthStore();
    return `${auth.appRole ?? ""}:${auth.collegeId ?? ""}:${auth.organizationId ?? ""}:${auth.userId ?? ""}`;
  }
  const studentBoardLoaded = ref(false);
  const studentFeedOffset = ref(0);
  const studentFeedHasMore = ref(false);
  const feedPostRows = ref<StudentFeedPostRow[]>([]);
  const myFeedPostRows = ref<StudentFeedPostRow[]>([]);

  function rebuildPortalCache(list: EventRequestRow[]) {
    const next = new Map<string, PortalEvent>();
    for (const r of list) {
      next.set(r.id, mapRowToPortalEvent(r));
    }
    portalById.value = next;
  }

  function portalOf(row: EventRequestRow): PortalEvent {
    return portalById.value.get(row.id) ?? mapRowToPortalEvent(row);
  }

  const postedRows = computed(() => filterPostedEvents(rows.value));

  const postedEvents = computed<PortalEvent[]>(() => postedRows.value.map((r) => portalOf(r)));

  const scheduledEvents = computed<PortalEvent[]>(() =>
    filterCalendarEvents(rows.value).map((r) => portalOf(r)),
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

  async function load(force = false): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const auth = useAuthStore();
    if (!auth.userId || !auth.appRole) return false;
    const scopeKey = currentScopeKey();
    if (scopeKey !== loadScopeKey.value) {
      loadScopeKey.value = scopeKey;
      loaded.value = false;
      force = true;
    }
    if (loaded.value && !force && Date.now() - lastLoadedAt.value < STALE_MS) return false;

    if (inFlight && inFlight.scope === scopeKey) {
      if (!force || inFlight.force) return inFlight.promise;
      await inFlight.promise.catch(() => undefined);
      if (loaded.value && Date.now() - lastLoadedAt.value < 2_000) {
        // Just finished; still honor force after a soft load.
      }
    }

    const runForce = force;
    const promise = (async (): Promise<boolean> => {
      loading.value = true;
      error.value = null;
      try {
        const nextRows = await withRetry(
          () =>
            fetchPortalEventRequestsForRole({
              role: auth.appRole!,
              userId: auth.userId!,
              collegeId: auth.collegeId,
              organizationId: auth.organizationId,
            }),
          2,
        );
        rows.value = nextRows;
        rebuildPortalCache(nextRows);
        loaded.value = true;
        lastLoadedAt.value = Date.now();
        return true;
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
        throw e;
      } finally {
        loading.value = false;
      }
    })();

    inFlight = { scope: scopeKey, force: runForce, promise };
    try {
      return await promise;
    } finally {
      if (inFlight?.promise === promise) inFlight = null;
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
    }).map((r) => portalOf(r));
  }

  function approvedForRole(role: AppRole, userId: string): PortalEvent[] {
    const auth = useAuthStore();
    return filterApprovedForRole(rows.value, role, userId, {
      organizationId: auth.organizationId,
    }).map((r) => portalOf(r));
  }

  function declinedForRole(role: AppRole, userId: string): PortalEvent[] {
    const auth = useAuthStore();
    return filterDeclinedForRole(rows.value, role, userId, {
      organizationId: auth.organizationId,
    }).map((r) => portalOf(r));
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
    const office = auth.appRole === "gso" || auth.appRole === "it_infrastructure" || auth.appRole === "sports_office" || auth.appRole === "ssc"
      ? auth.appRole === "ssc"
        ? "ssc"
        : auth.appRole
      : null;
    const row = rows.value.find((r) => r.id === id);
    if (office && row?.current_step === "resource_offices") {
      const { approveResourceAssignment } = await import("@/services/eventRequestsDb");
      await approveResourceAssignment(id, auth.userId, auth.appRole);
    } else {
      await approveEventRequest(id, auth.userId, auth.appRole);
    }
    await load(true);
  }

  async function decline(id: string, reason = "Declined") {
    const auth = useAuthStore();
    if (!auth.userId || !auth.appRole) throw new Error("You must be signed in.");
    const row = rows.value.find((r) => r.id === id);
    if (
      row?.current_step === "resource_offices" &&
      (auth.appRole === "gso" ||
        auth.appRole === "it_infrastructure" ||
        auth.appRole === "sports_office" ||
        auth.appRole === "ssc")
    ) {
      const { declineResourceAssignment } = await import("@/services/eventRequestsDb");
      await declineResourceAssignment(id, auth.userId, auth.appRole, reason);
    } else {
      await declineEventRequest(id, auth.userId, auth.appRole, reason);
    }
    await load(true);
  }

  async function approveAndForward(id: string, assignments: import("@/types/resourceOffice").ResourceAssignmentInput[]) {
    const auth = useAuthStore();
    if (!auth.userId) throw new Error("You must be signed in.");
    const { approveAndForwardEventRequest } = await import("@/services/eventRequestsDb");
    await approveAndForwardEventRequest(id, auth.userId, assignments);
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

  async function cancelScheduled(id: string, reason: string) {
    const auth = useAuthStore();
    if (!auth.userId) throw new Error("You must be signed in.");
    if (auth.appRole !== "eo" && auth.appRole !== "admin") {
      throw new Error("Only the Executive Officer can cancel scheduled events.");
    }
    await cancelScheduledEventRequest(id, auth.userId, reason);
    await load(true);
  }

  function monitoringForRole(role: AppRole, userId: string): PortalEvent[] {
    const auth = useAuthStore();
    return filterMonitoringForRole(rows.value, role, userId, {
      collegeId: auth.collegeId,
      organizationId: auth.organizationId,
    }).map((r) => portalOf(r));
  }

  async function ensureDocuments(id: string): Promise<PortalEvent | null> {
    const idx = rows.value.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    const row = rows.value[idx]!;
    if (row.event_request_letters != null && row.event_request_compliance_comments != null) {
      return portalOf(row);
    }
    const { fetchEventRequestDocuments } = await import("@/services/eventRequestsDb");
    const docs = await fetchEventRequestDocuments(id);
    const next: EventRequestRow = {
      ...row,
      event_request_letters: docs.letters,
      event_request_compliance_comments: docs.comments,
    };
    const copy = rows.value.slice();
    copy[idx] = next;
    rows.value = copy;
    const mapped = mapRowToPortalEvent(next);
    const cache = new Map(portalById.value);
    cache.set(id, mapped);
    portalById.value = cache;
    return mapped;
  }

  async function requestRevision(id: string, comment: string, attachmentFile?: File | null) {
    const auth = useAuthStore();
    if (!auth.userId || !auth.appRole) throw new Error("You must be signed in.");
    const { requestRevision: requestRevisionDb } = await import("@/services/eventRequestsDb");
    await requestRevisionDb(id, auth.userId, auth.appRole, comment, attachmentFile);
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
    await ensureDocuments(id);
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
    lastLoadedAt,
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
    monitoringForRole,
    ensureDocuments,
    submit,
    approve,
    decline,
    approveAndForward,
    requestRevision,
    postToCalendar,
    update,
    cancelScheduled,
    resubmitDeclined,
    getPortalEvent,
  };
});
