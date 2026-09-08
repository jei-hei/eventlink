<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { GitBranch, X } from "lucide-vue-next";
import PaginationControls from "@/components/PaginationControls.vue";
import ProposalPdfButton from "@/components/ProposalPdfButton.vue";
import {
  appRoleToEventsLogScope,
  fetchEventTrail,
  fetchEventTrailContext,
  type EventTrailContext,
  type EventTrailEntry,
} from "@/services/eventsLogDb";
import { fetchEventRequestDocuments } from "@/services/eventRequestsDb";
import { getComplianceAttachmentSignedUrl } from "@/services/complianceAttachmentStorage";
import type { AppRole } from "@/types/appRole";
import { DEFAULT_PAGE_SIZE } from "@/types/pagination";
import { toUserFacingError } from "@/utils/userFacingError";
import type { EventRequestRow } from "@/types/eventRequest";
import { useAuthStore } from "@/stores/auth";

const props = defineProps<{
  open: boolean;
  requestId: string | null;
  role: AppRole;
  collegeId?: string | null;
  organizationId?: string | null;
  userId?: string | null;
}>();

const emit = defineEmits<{ close: [] }>();

const detailLoading = ref(false);
const detailError = ref<string | null>(null);
const context = ref<EventTrailContext | null>(null);
const trail = ref<EventTrailEntry[]>([]);
const trailPage = ref(1);
const trailPageSize = ref(DEFAULT_PAGE_SIZE);
const trailTotal = ref(0);
const letters = ref<NonNullable<EventRequestRow["event_request_letters"]>>([]);
const comments = ref<NonNullable<EventRequestRow["event_request_compliance_comments"]>>([]);

const analyticsScope = computed(() => appRoleToEventsLogScope(props.role));
const auth = useAuthStore();

const scopePayload = computed(() => {
  if (auth.appRole !== "eo" || analyticsScope.value !== "eo") return null;
  return {
    role: "eo" as const,
    collegeId: props.collegeId,
    organizationId: props.organizationId,
    userId: props.userId,
  };
});

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function metadataField(entry: EventTrailEntry, ...keys: string[]): string | null {
  for (const key of keys) {
    const val = entry.metadata[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return null;
}

function scheduleChanges(entry: EventTrailEntry): { label: string; from: string; to: string }[] {
  const previous = metadataField(entry, "previous_value");
  const next = metadataField(entry, "new_value");
  if (previous || next) {
    const field = metadataField(entry, "affected_field") ?? "Value";
    return [{ label: field, from: previous ?? "—", to: next ?? "—" }];
  }
  const pairs: [string, string[], string[]][] = [
    ["Venue", ["old_venue", "previous_venue"], ["new_venue", "venue"]],
    ["Start date", ["old_start_date", "previous_start_date"], ["new_start_date", "start_date"]],
    ["End date", ["old_end_date", "previous_end_date"], ["new_end_date", "end_date"]],
    ["Start time", ["old_start_time", "previous_start_time"], ["new_start_time", "start_time"]],
    ["End time", ["old_end_time", "previous_end_time"], ["new_end_time", "end_time"]],
  ];
  const out: { label: string; from: string; to: string }[] = [];
  for (const [label, fromKeys, toKeys] of pairs) {
    const from = metadataField(entry, ...fromKeys);
    const to = metadataField(entry, ...toKeys);
    if (from || to) out.push({ label, from: from ?? "—", to: to ?? "—" });
  }
  return out;
}

async function loadTrailDetail() {
  const target = props.requestId?.trim();
  const scope = scopePayload.value;
  if (!target || !scope) {
    detailError.value = "You are not authorized to view this event trail.";
    return;
  }

  detailLoading.value = true;
  detailError.value = null;
  try {
    const summary = await fetchEventTrailContext(target, scope);
    if (!summary) {
      trail.value = [];
      trailTotal.value = 0;
      letters.value = [];
      comments.value = [];
      context.value = null;
      detailError.value = "You are not authorized to view this event trail.";
      return;
    }

    const [trailResult, docs] = await Promise.all([
      fetchEventTrail(target, scope, { page: trailPage.value, pageSize: trailPageSize.value }),
      fetchEventRequestDocuments(target),
    ]);
    trail.value = trailResult.rows;
    trailTotal.value = trailResult.total;
    trailPage.value = trailResult.page;
    trailPageSize.value = trailResult.pageSize;
    letters.value = docs.letters;
    comments.value = docs.comments;
    context.value = summary;
    if (!trailResult.total) {
      detailError.value = "No trail found for this event in your scope.";
    }
  } catch (e) {
    trail.value = [];
    trailTotal.value = 0;
    letters.value = [];
    comments.value = [];
    context.value = null;
    detailError.value = toUserFacingError(e, "Could not load event trail.");
  } finally {
    detailLoading.value = false;
  }
}

function closeDetail() {
  emit("close");
}

async function openComplianceFile(path: string) {
  const url = await getComplianceAttachmentSignedUrl(path);
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

watch(
  () => [props.open, props.requestId],
  () => {
    if (!props.open || !props.requestId) {
      context.value = null;
      trail.value = [];
      return;
    }
    trailPage.value = 1;
    void loadTrailDetail();
  },
);

watch([trailPage, trailPageSize], () => {
  if (!props.open || !props.requestId || detailLoading.value) return;
  void loadTrailDetail();
});
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    @click.self="closeDetail"
  >
    <div class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl">
      <div class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
        <div class="flex items-center gap-2">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
            <GitBranch :size="16" class="text-emerald-700" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-gray-800">{{ context?.activity ?? "Event trail" }}</h3>
            <p class="text-xs text-gray-500">Complete history, notes, and files</p>
          </div>
        </div>
        <button type="button" class="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" @click="closeDetail">
          <X :size="18" />
        </button>
      </div>

      <div class="space-y-4 p-5">
        <p
          v-if="detailError"
          class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
        >
          {{ detailError }}
        </p>
        <div v-if="detailLoading" class="py-8 text-center text-xs text-gray-500">Loading event trail…</div>

        <template v-else-if="context">
          <div>
            <h4 class="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Event details</h4>
            <div class="grid grid-cols-1 gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs sm:grid-cols-2">
              <div><span class="text-gray-400">Event name:</span> {{ context.activity }}</div>
              <div><span class="text-gray-400">Organization:</span> {{ context.organizationName }}</div>
              <div><span class="text-gray-400">College:</span> {{ context.collegeName }}</div>
              <div><span class="text-gray-400">Requester:</span> {{ context.requesterName }}</div>
              <div><span class="text-gray-400">Event date:</span> {{ context.startDate }}<template v-if="context.endDate && context.endDate !== context.startDate"> – {{ context.endDate }}</template></div>
              <div><span class="text-gray-400">Event time:</span> {{ context.startTime || "—" }}<template v-if="context.endTime"> – {{ context.endTime }}</template></div>
              <div><span class="text-gray-400">Venue:</span> {{ context.venue }}</div>
              <div><span class="text-gray-400">Current status:</span> {{ context.status }}</div>
              <div><span class="text-gray-400">Current step:</span> {{ context.currentStep ?? "—" }}</div>
              <div v-if="context.purpose" class="sm:col-span-2">
                <span class="text-gray-400">Description:</span> {{ context.purpose }}
              </div>
            </div>
          </div>

          <div v-if="context.letterPath || letters.length || comments.some((c) => c.attachment_path)" class="space-y-2">
            <h4 class="text-xs font-bold uppercase tracking-wider text-gray-500">Files &amp; documents</h4>
            <ProposalPdfButton v-if="context.letterPath" :letter-path="context.letterPath" label="Event proposal letter" current />
            <ProposalPdfButton
              v-for="letter in letters.filter((l) => l.letter_path !== context?.letterPath)"
              :key="letter.id"
              :letter-path="letter.letter_path"
              :label="letter.label"
            />
            <div
              v-for="comment in comments.filter((c) => c.attachment_path)"
              :key="comment.id"
              class="rounded-lg border border-gray-200 bg-gray-50 p-3"
            >
              <p class="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">Compliance attachment</p>
              <p class="mb-2 truncate text-sm text-gray-700">{{ comment.attachment_name || "Attachment" }}</p>
              <p v-if="comment.comment" class="mb-2 text-xs text-gray-600">{{ comment.comment }}</p>
              <button
                type="button"
                class="rounded-lg bg-[#16A34A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#15803D]"
                @click="openComplianceFile(comment.attachment_path!)"
              >
                View file
              </button>
            </div>
          </div>

          <div v-if="comments.length" class="space-y-2">
            <h4 class="text-xs font-bold uppercase tracking-wider text-gray-500">Compliance comments</h4>
            <div
              v-for="comment in comments"
              :key="`c-${comment.id}`"
              class="rounded-lg border border-gray-100 px-3 py-2 text-xs text-gray-700"
            >
              <p class="font-semibold">{{ comment.sender_role }} · {{ formatDate(comment.created_at) }}</p>
              <p class="mt-1">{{ comment.comment }}</p>
            </div>
          </div>

          <div>
            <h4 class="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Event trail</h4>
            <ol class="relative ml-3 space-y-4 border-l-2 border-emerald-100 pl-5">
              <li v-for="(entry, idx) in trail" :key="entry.id" class="relative">
                <span class="absolute -left-[1.35rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 shadow-sm" />
                <div class="space-y-2 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      {{ entry.actionLabel }}
                    </span>
                    <span class="text-[10px] text-gray-400">Step {{ idx + 1 + (trailPage - 1) * trailPageSize }}</span>
                  </div>
                  <div class="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                    <div><span class="text-gray-400">Person:</span> {{ entry.actorName }}</div>
                    <div><span class="text-gray-400">Role:</span> {{ entry.actorRoleLabel }}</div>
                    <div><span class="text-gray-400">Office:</span> {{ entry.office ?? "—" }}</div>
                    <div><span class="text-gray-400">When:</span> {{ formatDate(entry.createdAt) }}</div>
                    <div v-if="metadataField(entry, 'resource_name')">
                      <span class="text-gray-400">Resource:</span>
                      {{ metadataField(entry, "resource_kind") ?? "item" }}
                      ·
                      {{ metadataField(entry, "resource_name") }}
                    </div>
                  </div>
                  <div v-if="entry.previousStatus || entry.newStatus" class="text-xs text-gray-600">
                    <span class="text-gray-400">Status:</span>
                    {{ entry.previousStatus ?? "—" }} → {{ entry.newStatus ?? "—" }}
                  </div>
                  <p v-if="entry.notes" class="text-xs text-gray-700">
                    <span class="text-gray-400">Notes:</span> {{ entry.notes }}
                  </p>
                  <div v-if="scheduleChanges(entry).length" class="space-y-1">
                    <p class="text-xs font-semibold text-gray-700">Previous / new values</p>
                    <div
                      v-for="change in scheduleChanges(entry)"
                      :key="change.label"
                      class="grid grid-cols-[auto_1fr_auto_1fr] gap-x-2 text-xs text-gray-600"
                    >
                      <span class="text-gray-400">{{ change.label }}:</span>
                      <span>{{ change.from }}</span>
                      <span class="text-gray-300">→</span>
                      <span>{{ change.to }}</span>
                    </div>
                  </div>
                </div>
              </li>
            </ol>
          </div>

          <PaginationControls
            v-if="trailTotal > 0"
            :page="trailPage"
            :page-size="trailPageSize"
            :total="trailTotal"
            :loading="detailLoading"
            @update:page="trailPage = $event"
            @update:page-size="
              (size) => {
                trailPageSize = size;
                trailPage = 1;
              }
            "
          />
        </template>
      </div>
    </div>
  </div>
</template>
