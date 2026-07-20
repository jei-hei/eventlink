import { computed, onMounted, onUnmounted, ref, watch, type Ref } from "vue";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { useEventRequestsStore } from "@/stores/eventRequests";
import type { AppRole } from "@/types/appRole";
import type { PortalEvent } from "@/types/portalEvent";
import type { CreateEventRequestInput } from "@/types/eventRequest";
import type { UpdateEventRequestInput } from "@/services/eventRequestsDb";
import type { CreateStudentFeedPostInput } from "@/types/studentPost";

type MockState = {
  events: Ref<PortalEvent[]>;
  approvedEvents: Ref<PortalEvent[]>;
};

export function usePortalEvents(
  role: AppRole,
  mock: MockState,
  options?: { canPost?: boolean },
) {
  const auth = useAuthStore();
  const store = useEventRequestsStore();
  const useDb = computed(() => isSupabaseConfigured && !!auth.userId && !auth.useMock);
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let refreshing = false;

  async function refreshEvents(force = true) {
    if (!useDb.value || refreshing) return;
    refreshing = true;
    try {
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await store.load(force);
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
        }
      }
      if (lastErr) throw lastErr;
    } finally {
      refreshing = false;
    }
  }

  function startPolling() {
    if (pollTimer || !useDb.value) return;
    pollTimer = setInterval(() => {
      void refreshEvents(true);
    }, 25000);
  }

  function stopPolling() {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
  }

  onMounted(() => {
    void refreshEvents(true);
    startPolling();
  });
  onUnmounted(stopPolling);

  watch(
    () => auth.userId,
    (id) => {
      if (id && useDb.value) {
        void refreshEvents(true);
        startPolling();
      } else {
        stopPolling();
      }
    },
  );
  watch(
    () => [auth.appRole, auth.collegeId, auth.organizationId],
    () => {
      if (useDb.value) void refreshEvents(true);
    },
  );

  const events = computed(() => {
    if (!useDb.value || !auth.userId) return mock.events.value;
    return store.pendingForRole(role, auth.userId);
  });

  const approvedEvents = computed(() => {
    if (!useDb.value || !auth.userId) return mock.approvedEvents.value;
    return store.approvedForRole(role, auth.userId);
  });

  const declinedEvents = computed(() => {
    if (!useDb.value || !auth.userId) return [];
    return store.declinedForRole(role, auth.userId);
  });

  /** All approved/posted events for the shared schedule calendar (not scoped to submitter). */
  const scheduledEvents = computed(() => {
    if (!useDb.value) return mock.approvedEvents.value;
    return store.scheduledEvents;
  });

  const busy = ref(false);

  async function runAction(fn: () => Promise<void>) {
    if (busy.value) return;
    busy.value = true;
    try {
      await fn();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      busy.value = false;
    }
  }

  function handleApprove(id: string) {
    if (useDb.value) {
      void runAction(() => store.approve(id));
      return;
    }
    const ev = mock.events.value.find((e) => e.id === id);
    if (!ev) return;
    mock.approvedEvents.value = [...mock.approvedEvents.value, { ...ev, status: "Approved" }];
    mock.events.value = mock.events.value.filter((e) => e.id !== id);
  }

  function handleReject(id: string) {
    if (useDb.value) {
      const reason = window.prompt("Reason for decline (optional):") ?? "Declined";
      void runAction(() => store.decline(id, reason));
      return;
    }
    mock.events.value = mock.events.value.filter((e) => e.id !== id);
  }

  function handleCreateEvent(newEvent: PortalEvent) {
    if (useDb.value) return;
    if (newEvent.createdBy === "EO") {
      mock.approvedEvents.value = [...mock.approvedEvents.value, newEvent];
    } else {
      mock.events.value = [...mock.events.value, newEvent];
    }
  }

  async function submitRequest(input: CreateEventRequestInput) {
    await store.submit(input);
  }

  const canPostToStudents = computed(() => role === "ssc" || role === "student_officer");

  const canPostToCalendar = computed(() => options?.canPost === true || role === "eo");

  async function handleCreateFeedPost(input: CreateStudentFeedPostInput) {
    if (useDb.value) {
      await store.createFeedPost(input);
      return;
    }
    window.alert("Connect Supabase to publish to the student feed.");
  }

  function handlePostEvent(id: string) {
    if (useDb.value) {
      if (canPostToCalendar.value) {
        void runAction(() => store.postToCalendar(id));
        return;
      }
      return;
    }

    const fromPending = mock.events.value.find((e) => e.id === id);
    if (canPostToCalendar.value && fromPending) {
      mock.events.value = mock.events.value.map((e) =>
        e.id === id
          ? {
              ...e,
              calendarPosted: true,
              awaitingCalendarPost: false,
            }
          : e,
      );
      return;
    }

    if (canPostToStudents.value && fromPending) {
      mock.events.value = mock.events.value.filter((e) => e.id !== id);
      mock.approvedEvents.value = [
        ...mock.approvedEvents.value,
        {
          ...fromPending,
          posted: true,
          awaitingPublish: false,
          status: "Approved",
          workflowStatus: "Approved",
        },
      ];
      return;
    }

    mock.approvedEvents.value = mock.approvedEvents.value.map((e) =>
      e.id === id ? { ...e, posted: true, awaitingPublish: false } : e,
    );
  }

  async function handleUpdateEvent(id: string, input: UpdateEventRequestInput) {
    if (useDb.value) {
      await runAction(() => store.update(id, input));
      return;
    }
    mock.approvedEvents.value = mock.approvedEvents.value.map((e) => {
      if (e.id !== id) return e;
      return {
        ...e,
        name: input.activity,
        activity: input.activity,
        venue: input.venue,
        participants: input.numberOfParticipants,
        sdgs: input.sdgs,
        purpose: input.purpose,
        startDate: input.startDate,
        endDate: input.endDate,
      };
    });
  }

  async function handleResubmitDeclined(id: string, input: UpdateEventRequestInput) {
    if (useDb.value) {
      await runAction(() => store.resubmitDeclined(id, input));
      return;
    }
  }

  return {
    events,
    approvedEvents,
    declinedEvents,
    scheduledEvents,
    handleApprove,
    handleReject,
    handleCreateEvent,
    handlePostEvent,
    handleCreateFeedPost,
    handleUpdateEvent,
    handleResubmitDeclined,
    submitRequest,
    useDb,
    busy,
    store,
    canPostToStudents,
    canPostToCalendar,
  };
}
