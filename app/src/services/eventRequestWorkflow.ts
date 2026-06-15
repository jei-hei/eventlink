import type { DbRequestType, DbWorkflowStep } from "@/types/eventRequest";

const OFFICER_CHAIN: DbWorkflowStep[] = ["adviser", "dean", "osas", "eo_schedule", "gso", "eo_publish"];
const SSC_CHAIN: DbWorkflowStep[] = ["osas", "eo_schedule", "gso", "eo_publish"];

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
  needsGso: boolean,
): DbWorkflowStep | null {
  if (requestType === "eo_direct") return null;
  const chain = getWorkflowChain(requestType);
  const idx = currentStep ? chain.indexOf(currentStep) : -1;
  for (let i = idx + 1; i < chain.length; i++) {
    const step = chain[i]!;
    if (step === "gso" && !needsGso) continue;
    return step;
  }
  return null;
}

const STEP_LABEL: Record<DbWorkflowStep, string> = {
  adviser: "Adviser",
  dean: "Dean",
  osas: "OSAS",
  eo_schedule: "EO (Schedule)",
  gso: "GSO",
  eo_publish: "EO (Publish)",
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
    case "eo_publish":
      return "Pending EO";
    default:
      return "Pending";
  }
}

export function roleMatchesStep(
  role: string,
  step: DbWorkflowStep | null,
): boolean {
  if (!step) return false;
  if (role === "adviser") return step === "adviser";
  if (role === "dean") return step === "dean";
  if (role === "osas") return step === "osas";
  if (role === "gso") return step === "gso";
  if (role === "eo") return step === "eo_schedule" || step === "eo_publish";
  return false;
}

export function buildWorkflowHistory(
  requestType: DbRequestType,
  currentStep: DbWorkflowStep | null,
  needsGso: boolean,
  historyApprovals: { step: DbWorkflowStep; approver: string; at: string }[],
): { name: string; status: "completed" | "current" | "pending"; timestamp?: string; approver?: string }[] {
  const chain = getWorkflowChain(requestType).filter((s) => s !== "gso" || needsGso);
  return chain.map((step) => {
    const done = historyApprovals.find((h) => h.step === step);
    const isCurrent = step === currentStep;
    return {
      name: STEP_LABEL[step],
      status: done ? "completed" : isCurrent ? "current" : "pending",
      timestamp: done?.at,
      approver: done?.approver,
    };
  });
}
