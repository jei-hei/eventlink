import { computed, onMounted, onUnmounted, ref, watch, type Ref } from "vue";
import { usePageVisibility } from "@/composables/usePageVisibility";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { useEventRequestsStore } from "@/stores/eventRequests";
import { useUiStore } from "@/stores/ui";
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
  const ui = useUiStore();
  const { visible: pageVisible } = usePageVisibility();
  const useDb = computed(() => isSupabaseConfigured && !!auth.userId && !auth.useMock);
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let refreshing = false;
  const POLL_MS_VISIBLE = 60_000;
  const POLL_MS_HIDDEN = 180_000;

  async function refreshEvents(force = false): Promise<boolean> {
    if (!useDb.value || refreshing) return false;
    refreshing = true;
    try {
      return await store.load(force);
    } finally {
      refreshing = false;
    }
  }

  function schedulePoll() {
    stopPolling();
    if (!useDb.value) return;
    const ms = pageVisible.value ? POLL_MS_VISIBLE : POLL_MS_HIDDEN;
    pollTimer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void refreshEvents(false);
    }, ms);
  }

  function stopPolling() {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
  }

  onMounted(() => {
    // Soft load if store already warm; force only on first entry.
    void refreshEvents(!store.loaded);
    schedulePoll();
  });
  onUnmounted(stopPolling);

  watch(pageVisible, () => {
    if (!useDb.value) return;
    // Data refresh on visibility is owned by App.vue after session revalidation.
    schedulePoll();
  });

  watch(
    () => auth.userId,
    (id) => {
      if (id && useDb.value) {
        void refreshEvents(!store.loaded);
        schedulePoll();
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

  async function runAction(fn: () => Promise<void>, successToast?: { title: string; description?: string }) {
    if (busy.value) return;
    busy.value = true;
    try {
      await fn();
      if (successToast) {
        ui.pushToast(successToast.title, successToast.description, "success");
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      busy.value = false;
    }
  }

  function handleApprove(id: string) {
    if (useDb.value) {
      void runAction(() => store.approve(id), {
        title: "Event approved successfully.",
        description: "The event request was approved.",
      });
      return;
    }
    const ev = mock.events.value.find((e) => e.id === id);
    if (!ev) return;
    mock.approvedEvents.value = [...mock.approvedEvents.value, { ...ev, status: "Approved" }];
    mock.events.value = mock.events.value.filter((e) => e.id !== id);
    ui.pushToast("Request approved successfully.", "The event request was approved.", "success");
  }

  function handleReject(id: string) {
    if (useDb.value) {
      const reason = window.prompt("Reason for decline (required):") ?? "";
      if (!reason.trim()) {
        window.alert("A decline reason is required.");
        return;
      }
      void runAction(() => store.decline(id, reason.trim()));
      return;
    }
    mock.events.value = mock.events.value.filter((e) => e.id !== id);
  }

  async function handleApproveAndForward(
    id: string,
    assignments: import("@/types/resourceOffice").ResourceAssignmentInput[],
  ) {
    if (useDb.value) {
      await runAction(() => store.approveAndForward(id, assignments), {
        title: "Event forwarded successfully.",
        description: "Resources were assigned to the responsible offices.",
      });
      return;
    }
    mock.events.value = mock.events.value.filter((e) => e.id !== id);
    ui.pushToast(
      "Request approved successfully.",
      "Resources were forwarded to the responsible offices.",
      "success",
    );
  }

  function handleCreateEvent(newEvent: PortalEvent) {
    if (useDb.value) return;
    if (newEvent.createdBy === "EO") {
      mock.approvedEvents.value = [...mock.approvedEvents.value, newEvent];
    } else {
      mock.events.value = [...mock.events.value, newEvent];
    }
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
      void runAction(() => store.postToCalendar(id), {
          title: "Event scheduled successfully.",
          description: "The event was posted to the staff calendar.",
        });
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

  async function handleCancelScheduled(id: string, reason: string) {
    if (useDb.value) {
      await runAction(() => store.cancelScheduled(id, reason), {
        title: "Event cancelled successfully.",
        description: "The scheduled event was cancelled.",
      });
      return;
    }
  }

  async function handleResubmitDeclined(id: string, input: UpdateEventRequestInput) {
    if (useDb.value) {
      await runAction(() => store.resubmitDeclined(id, input), {
        title: "Event resubmitted successfully.",
        description: "Your corrected request was sent back into the workflow.",
      });
      return;
    }
  }

  async function handleRequestRevision(
    id: string,
    comment: string,
    attachmentFile?: File | null,
  ) {
    if (useDb.value) {
      await runAction(() => store.requestRevision(id, comment, attachmentFile), {
        title: "Revision request sent successfully.",
        description: "The requester was notified with your compliance comment.",
      });
      return;
    }
  }

  async function submitRequest(input: CreateEventRequestInput) {
    await store.submit(input);
    if (input.letterFile) {
      ui.pushToast(
        "PDF uploaded successfully.",
        "Your event request was submitted with the proposal PDF.",
        "success",
      );
    }
  }

  return {
    events,
    approvedEvents,
    declinedEvents,
    scheduledEvents,
    handleApprove,
    handleReject,
    handleApproveAndForward,
    handleRequestRevision,
    handleCreateEvent,
    handlePostEvent,
    handleCreateFeedPost,
    handleUpdateEvent,
    handleCancelScheduled,
    handleResubmitDeclined,
    submitRequest,
    useDb,
    busy,
    store,
    canPostToStudents,
    canPostToCalendar,
  };
}
