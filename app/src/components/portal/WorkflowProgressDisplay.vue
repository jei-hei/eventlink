<script setup lang="ts">
import { computed } from "vue";
import type { PortalEvent, WorkflowStepUi } from "@/types/portalEvent";
import { resourceOfficeLabel } from "@/types/resourceOffice";

const props = defineProps<{ event: PortalEvent }>();

type Stage = {
  key: string;
  name: string;
  status: "completed" | "current" | "pending" | "declined" | "revision";
  detail?: string;
};

const stages = computed<Stage[]>(() => {
  const ev = props.event;
  const base: Stage[] = (ev.workflowHistory ?? []).map((s: WorkflowStepUi) => ({
    key: s.name,
    name: s.name,
    status: s.status,
    detail: s.approver ? `${s.approver}${s.timestamp ? ` · ${s.timestamp}` : ""}` : s.timestamp,
  }));

  const wf = String(ev.workflowStatus ?? "").toLowerCase();
  if (wf.includes("revision")) {
    return [
      ...base.map((s) =>
        s.status === "current" ? { ...s, status: "revision" as const } : s,
      ),
    ];
  }
  if (wf.includes("reject") || wf.includes("declin")) {
    return base.map((s) =>
      s.status === "current" ? { ...s, status: "declined" as const, detail: ev.declineReason } : s,
    );
  }

  const resourceStages: Stage[] = [];
  const byOffice = new Map<string, { pending: number; approved: number; declined: number }>();
  for (const a of ev.resourceAssignments ?? []) {
    const cur = byOffice.get(a.assignedOffice) ?? { pending: 0, approved: 0, declined: 0 };
    if (a.status === "pending") cur.pending += 1;
    else if (a.status === "approved") cur.approved += 1;
    else cur.declined += 1;
    byOffice.set(a.assignedOffice, cur);
  }
  for (const [office, counts] of byOffice) {
    let status: Stage["status"] = "pending";
    if (counts.declined > 0) status = "declined";
    else if (counts.pending > 0) status = "current";
    else if (counts.approved > 0) status = "completed";
    resourceStages.push({
      key: `res-${office}`,
      name: resourceOfficeLabel(office as import("@/types/resourceOffice").ResourceOffice),
      status,
      detail: "Resource Approval",
    });
  }

  // Replace generic "Resource Offices" step with per-office rows when assignments exist.
  if (resourceStages.length) {
    const withoutGeneric = base.filter((s) => s.name !== "Resource Offices");
    const resourceIdx = base.findIndex((s) => s.name === "Resource Offices");
    if (resourceIdx >= 0) {
      return [...withoutGeneric.slice(0, resourceIdx), ...resourceStages, ...withoutGeneric.slice(resourceIdx)];
    }
    return [...withoutGeneric, ...resourceStages];
  }

  if (wf.includes("schedul") || wf.includes("approved") || wf.includes("cancel")) {
    const terminal: Stage = {
      key: "terminal",
      name: wf.includes("cancel") ? "Cancelled" : "Scheduled",
      status: "completed",
    };
    return [...base.filter((s) => s.name !== "Resource Offices" || !resourceStages.length), terminal];
  }

  return base;
});

function mark(status: Stage["status"]) {
  if (status === "completed") return "✓";
  if (status === "current") return "●";
  if (status === "declined") return "✗";
  if (status === "revision") return "!";
  return "○";
}

function markClass(status: Stage["status"]) {
  if (status === "completed") return "text-emerald-700";
  if (status === "current") return "text-amber-600";
  if (status === "declined") return "text-red-600";
  if (status === "revision") return "text-amber-700";
  return "text-slate-400";
}
</script>

<template>
  <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
    <p class="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Workflow progress</p>
    <ul class="space-y-2">
      <li v-for="s in stages" :key="s.key" class="flex items-start gap-2 text-sm">
        <span class="w-4 shrink-0 font-bold" :class="markClass(s.status)">{{ mark(s.status) }}</span>
        <div class="min-w-0">
          <p class="font-medium text-slate-800">
            {{ s.name }}
            <span v-if="s.detail === 'Resource Approval'" class="text-xs font-normal text-slate-500">
              · Resource Approval
            </span>
          </p>
          <p v-if="s.detail && s.detail !== 'Resource Approval'" class="text-xs text-slate-500">
            {{ s.detail }}
          </p>
          <p class="text-[11px] uppercase tracking-wide text-slate-400">
            <template v-if="s.status === 'completed'">Completed</template>
            <template v-else-if="s.status === 'current'">Current</template>
            <template v-else-if="s.status === 'declined'">Declined</template>
            <template v-else-if="s.status === 'revision'">Revision requested</template>
            <template v-else>Pending</template>
          </p>
        </div>
      </li>
    </ul>
  </div>
</template>
