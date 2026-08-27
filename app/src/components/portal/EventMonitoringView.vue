<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { Eye, Search } from "lucide-vue-next";
import { useAuthStore } from "@/stores/auth";
import { useEventRequestsStore } from "@/stores/eventRequests";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { PortalEvent } from "@/types/portalEvent";
import EventLetterLink from "@/components/EventLetterLink.vue";
import PortalTableSkeleton from "@/components/portal/PortalTableSkeleton.vue";
import WorkflowProgressDisplay from "@/components/portal/WorkflowProgressDisplay.vue";
import DeclinedResubmitModal from "@/components/portal/DeclinedResubmitModal.vue";
import EventFeedbackModal from "@/components/portal/EventFeedbackModal.vue";
import { getComplianceAttachmentSignedUrl } from "@/services/complianceAttachmentStorage";
import type { UpdateEventRequestInput } from "@/services/eventRequestsDb";
import { useUiStore } from "@/stores/ui";

const auth = useAuthStore();
const store = useEventRequestsStore();
const ui = useUiStore();

const loading = ref(true);
const selected = ref<PortalEvent | null>(null);
const search = ref("");
const resubmitEvent = ref<PortalEvent | null>(null);
const resubmitting = ref(false);
const feedbackOpen = ref(false);

const isRequester = computed(
  () => auth.appRole === "student_officer" || auth.appRole === "ssc",
);

async function refresh(force = false) {
  if (!isSupabaseConfigured || !auth.userId || !auth.appRole) {
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    await store.load(force);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void refresh(!store.loaded);
  if (isRequester.value) {
    void store.loadMyFeedPosts().catch(() => undefined);
  }
});

function linkedFeedPostId(event: PortalEvent): string | null {
  const post = store.myFeedPosts.find((p) => p.requestId === event.id);
  return post?.id ?? null;
}

function canViewFeedback(event: PortalEvent) {
  if (!isRequester.value) return false;
  const status = String(event.workflowStatus ?? event.status).toLowerCase();
  return (
    !!linkedFeedPostId(event) ||
    status.includes("schedul") ||
    status.includes("posted") ||
    status.includes("approved")
  );
}

async function openEvent(event: PortalEvent) {
  selected.value = event;
  try {
    const enriched = await store.ensureDocuments(event.id);
    if (enriched && selected.value?.id === event.id) {
      selected.value = enriched;
    }
  } catch {
    // list data still usable without document history
  }
}

const events = computed(() => {
  if (!auth.userId || !auth.appRole) return [];
  if (auth.appRole === "student") {
    return store.monitoringForRole("student", auth.userId);
  }
  return store.monitoringForRole(auth.appRole, auth.userId);
});

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return events.value;
  return events.value.filter((e) => {
    return (
      e.name.toLowerCase().includes(q) ||
      (e.organization ?? "").toLowerCase().includes(q) ||
      (e.venue ?? "").toLowerCase().includes(q) ||
      String(e.workflowStatus ?? e.status).toLowerCase().includes(q)
    );
  });
});

function statusClass(status: string) {
  const s = status.toLowerCase();
  if (s.includes("cancel")) return "bg-slate-200 text-slate-800";
  if (s.includes("revision")) return "bg-amber-100 text-amber-900";
  if (s.includes("schedul") || s.includes("approved")) return "bg-emerald-100 text-emerald-800";
  if (s.includes("reject") || s.includes("declin")) return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
}

function fmtUpdated(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function canResubmit(event: PortalEvent) {
  if (!isRequester.value) return false;
  const s = String(event.workflowStatus ?? "").toLowerCase();
  return s.includes("revision") || s.includes("reject") || s.includes("declin");
}

async function openAttachment(path: string) {
  const url = await getComplianceAttachmentSignedUrl(path);
  if (!url) {
    window.alert("Could not open the attachment.");
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

async function onResubmit(id: string, input: UpdateEventRequestInput) {
  if (resubmitting.value) return;
  resubmitting.value = true;
  try {
    await store.resubmitDeclined(id, input);
    ui.pushToast(
      "Event resubmitted successfully.",
      "Your corrected request was sent back into the workflow.",
      "success",
    );
    resubmitEvent.value = null;
    selected.value = null;
    await refresh(true);
  } catch (e) {
    window.alert(e instanceof Error ? e.message : String(e));
  } finally {
    resubmitting.value = false;
  }
}

onUnmounted(() => {
  selected.value = null;
  feedbackOpen.value = false;
});
</script>

<template>
  <div class="dash-page">
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="portal-section-title">Tracking</p>
        <h1 class="text-xl font-bold text-slate-900 sm:text-2xl">Event Monitoring</h1>
        <p class="mt-1 text-sm text-slate-600">
          Track where each event is in the approval workflow.
        </p>
      </div>
      <div class="relative w-full sm:max-w-xs">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          v-model="search"
          type="search"
          class="input-dash w-full pl-9"
          placeholder="Search events"
        />
      </div>
    </div>

    <div class="dash-card overflow-hidden">
      <div class="min-h-0 overflow-auto">
        <table class="w-full min-w-[48rem] text-left">
          <thead class="sticky top-0 z-10 bg-slate-50">
            <tr>
              <th class="border-r border-slate-200 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">Event</th>
              <th class="border-r border-slate-200 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">Organization</th>
              <th class="border-r border-slate-200 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">Date</th>
              <th class="border-r border-slate-200 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">Venue</th>
              <th class="border-r border-slate-200 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">Status</th>
              <th class="border-r border-slate-200 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">Updated</th>
              <th class="px-3 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            <PortalTableSkeleton v-if="loading" :rows="6" :columns="7" />
            <tr v-else-if="!filtered.length">
              <td colspan="7" class="py-12 text-center text-sm text-slate-400">No events to monitor</td>
            </tr>
            <tr
              v-for="event in filtered"
              v-else
              :key="event.id"
              class="cursor-pointer border-b border-slate-100 transition hover:bg-emerald-50/50"
              @click="openEvent(event)"
            >
              <td class="border-r border-slate-100 px-3 py-2.5 text-sm font-medium text-slate-800">{{ event.name }}</td>
              <td class="border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600">{{ event.organization || "—" }}</td>
              <td class="border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600">{{ event.date }}</td>
              <td class="border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600">{{ event.venue || "—" }}</td>
              <td class="border-r border-slate-100 px-3 py-2.5 text-sm">
                <span :class="['rounded-full px-2 py-0.5 text-xs font-semibold', statusClass(String(event.workflowStatus ?? event.status))]">
                  {{ event.workflowStatus ?? event.status }}
                </span>
              </td>
              <td class="border-r border-slate-100 px-3 py-2.5 text-sm text-slate-600">{{ fmtUpdated(event.updatedAt) }}</td>
              <td class="px-3 py-2 text-center" @click.stop>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  @click="openEvent(event)"
                >
                  <Eye :size="12" /> View
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div
      v-if="selected"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="selected = null"
    >
      <div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-2xl">
        <div class="flex items-center justify-between bg-emerald-600 px-6 py-4 text-white">
          <h3 class="text-base font-bold">Event details</h3>
          <button type="button" class="rounded-lg p-1.5 hover:bg-emerald-700" @click="selected = null; feedbackOpen = false">✕</button>
        </div>
        <div class="space-y-3 p-6 text-sm">
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-gray-500">Event</p>
            <p class="font-medium text-gray-800">{{ selected.name }}</p>
          </div>
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-gray-500">Organization</p>
            <p class="font-medium text-gray-800">{{ selected.organization || "—" }}</p>
          </div>
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-gray-500">Date / time</p>
            <p class="font-medium text-gray-800">
              {{ selected.date }}
              <span v-if="selected.startTime"> · {{ selected.startTime }} – {{ selected.endTime }}</span>
            </p>
          </div>
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-gray-500">Venue</p>
            <p class="font-medium text-gray-800">{{ selected.venue || "—" }}</p>
          </div>
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-gray-500">Current status</p>
            <p class="font-medium text-gray-800">{{ selected.workflowStatus ?? selected.status }}</p>
          </div>
          <div>
            <p class="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">Last updated</p>
            <p class="font-medium text-gray-800">{{ fmtUpdated(selected.updatedAt) }}</p>
          </div>

          <WorkflowProgressDisplay :event="selected" />

          <div v-if="selected.complianceComments?.length" class="space-y-2">
            <p class="text-xs font-bold uppercase tracking-wider text-gray-500">Compliance / revision comments</p>
            <div
              v-for="c in selected.complianceComments"
              :key="c.id"
              class="rounded-lg border border-amber-200 bg-amber-50 p-3"
            >
              <p class="text-sm text-slate-800 whitespace-pre-wrap">{{ c.comment }}</p>
              <p class="mt-2 text-xs text-slate-500">
                {{ c.senderName }} · {{ c.senderRole }} · {{ fmtUpdated(c.createdAt) }}
              </p>
              <button
                v-if="c.attachmentPath"
                type="button"
                class="mt-2 text-xs font-semibold text-emerald-700 underline"
                @click="openAttachment(c.attachmentPath!)"
              >
                View attachment{{ c.attachmentName ? `: ${c.attachmentName}` : "" }}
              </button>
            </div>
          </div>

          <div v-else-if="selected.declineReason && canResubmit(selected)" class="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p class="text-xs font-bold uppercase tracking-wider text-amber-800">Compliance comment</p>
            <p class="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{{ selected.declineReason }}</p>
          </div>

          <div v-if="selected.cancellationReason">
            <p class="text-xs font-bold uppercase tracking-wider text-gray-500">Cancellation note</p>
            <p class="font-medium text-gray-800">{{ selected.cancellationReason }}</p>
          </div>

          <EventLetterLink
            v-if="selected.letterPath"
            :letter-path="selected.letterPath"
            label="Current proposal PDF"
            :current="true"
          />
          <div v-if="selected.letterHistory?.length" class="space-y-2">
            <p class="text-xs font-bold uppercase tracking-wider text-gray-500">Document history</p>
            <EventLetterLink
              v-for="(doc, idx) in selected.letterHistory"
              :key="doc.id"
              :letter-path="doc.letterPath"
              :label="doc.label"
              :current="idx === 0"
            />
          </div>
        </div>
        <div class="flex flex-wrap justify-end gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4">
          <button type="button" class="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold" @click="selected = null">
            Close
          </button>
          <button
            v-if="selected && canViewFeedback(selected)"
            type="button"
            class="rounded-lg border border-emerald-600 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            @click="feedbackOpen = true"
          >
            View Feedback
          </button>
          <button
            v-if="canResubmit(selected)"
            type="button"
            class="rounded-lg bg-[#16A34A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#15803D]"
            @click="resubmitEvent = selected"
          >
            Edit &amp; Resubmit
          </button>
        </div>
      </div>
    </div>

    <EventFeedbackModal
      :open="feedbackOpen && !!selected"
      :event-title="selected?.name ?? 'Event'"
      :event-date="selected?.date"
      :event-time="selected ? `${selected.startTime ?? ''} – ${selected.endTime ?? ''}` : undefined"
      :venue="selected?.venue"
      :organization="selected?.organization"
      :feed-post-id="selected ? linkedFeedPostId(selected) : null"
      :request-id="selected?.id"
      @close="feedbackOpen = false"
    />

    <DeclinedResubmitModal
      :event="resubmitEvent"
      :submitting="resubmitting"
      @close="resubmitEvent = null"
      @submit="onResubmit"
    />
  </div>
</template>
