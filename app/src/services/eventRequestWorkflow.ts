import type { DbRequestType, DbWorkflowStep } from "@/types/eventRequest";
import type { ResourceOffice } from "@/types/resourceOffice";
import { resourceOfficeLabel } from "@/types/resourceOffice";

/** New chain: EO assigns offices, then parallel resource approvals auto-schedule. */
const OFFICER_CHAIN: DbWorkflowStep[] = ["adviser", "dean", "osas", "eo_schedule", "resource_offices"];
const SSC_CHAIN: DbWorkflowStep[] = ["osas", "eo_schedule", "resource_offices"];

export function getWorkflowChain(requestType: DbRequestType): DbWorkflowStep[] {
  if (requestType === "ssc") return SSC_CHAIN;
  if (requestType === "eo_direct") return [];
  return OFFICER_CHAIN;
}

export function getInitialStep(requestType: DbRequestType): DbWorkflowStep | null {
  const chain = getWorkflowChain(requestType);
  return chain[0] ?? null;
}

export function getNextStep(
  requestType: DbRequestType,
  currentStep: DbWorkflowStep | null,
  _needsGso: boolean,
): DbWorkflowStep | null {
  if (requestType === "eo_direct") return null;
  const chain = getWorkflowChain(requestType);
  const idx = currentStep ? chain.indexOf(currentStep) : -1;
  if (idx < 0) return chain[0] ?? null;
  return chain[idx + 1] ?? null;
}

const STEP_LABEL: Record<DbWorkflowStep, string> = {
  adviser: "Adviser",
  dean: "Dean",
  osas: "OSAS",
  eo_schedule: "EO (Assign Resources)",
  gso: "GSO",
  eo_publish: "EO (Publish)",
  resource_offices: "Resource Offices",
};

export function stepLabel(step: DbWorkflowStep | null): string {
  if (!step) return "Complete";
  return STEP_LABEL[step] ?? step;
}

export function workflowStatusForStep(step: DbWorkflowStep | null): string {
  switch (step) {
    case "adviser":
      return "Pending Adviser";
    case "dean":
      return "Pending Dean";
    case "gso":
      return "Pending GSO";
    case "osas":
      return "Pending OSAS";
    case "eo_schedule":
      return "Pending EO Review";
    case "eo_publish":
      return "Pending EO";
    case "resource_offices":
      return "Pending Resource Offices";
    default:
      return "Pending";
  }
}

/** Build a pending status label from currently pending assigned offices. */
export function workflowStatusForResourceOffices(offices: ResourceOffice[]): string {
  const unique = [...new Set(offices)];
  if (unique.length === 0) return "Pending Resource Approval";
  if (unique.length === 1) {
    const o = unique[0]!;
    if (o === "gso") return "Pending GSO Approval";
    if (o === "sports_office") return "Pending Sports Office Approval";
    if (o === "it_infrastructure") return "Pending IT Infrastructure Approval";
    if (o === "ssc") return "Pending SSC Venue Approval";
  }
  return "Pending Resource Approval";
}

export function roleMatchesStep(role: string, step: DbWorkflowStep | null): boolean {
  if (!step) return false;
  if (role === "adviser") return step === "adviser";
  if (role === "dean") return step === "dean";
  if (role === "osas") return step === "osas";
  if (role === "gso") return step === "gso" || step === "resource_offices";
  if (role === "it_infrastructure") return step === "resource_offices";
  if (role === "sports_office") return step === "resource_offices";
  if (role === "ssc") return step === "resource_offices";
  if (role === "eo") return step === "eo_schedule" || step === "eo_publish";
  return false;
}

export function appRoleToResourceOffice(role: string): ResourceOffice | null {
  if (role === "gso") return "gso";
  if (role === "it_infrastructure") return "it_infrastructure";
  if (role === "sports_office") return "sports_office";
  if (role === "ssc") return "ssc";
  return null;
}

export function buildWorkflowHistory(
  requestType: DbRequestType,
  currentStep: DbWorkflowStep | null,
  _needsGso: boolean,
  historyApprovals: { step: DbWorkflowStep; approver: string; at: string }[],
): { name: string; status: "completed" | "current" | "pending"; timestamp?: string; approver?: string }[] {
  const chain = getWorkflowChain(requestType);
  const currentIdx = currentStep ? chain.indexOf(currentStep) : -1;
  const allDone = currentStep == null && historyApprovals.length > 0;
  return chain.map((step, idx) => {
    const done = historyApprovals.find((h) => h.step === step);
    const isCurrent = step === currentStep;
    const inferredDone =
      !!done ||
      allDone ||
      (!isCurrent && currentIdx >= 0 && idx < currentIdx) ||
      (!isCurrent && currentIdx < 0 && currentStep == null);
    return {
      name: STEP_LABEL[step],
      status: inferredDone ? "completed" : isCurrent ? "current" : "pending",
      timestamp: done?.at,
      approver: done?.approver,
    };
  });
}
