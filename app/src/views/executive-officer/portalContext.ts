import type { InjectionKey, Ref } from "vue";
import { inject } from "vue";
import type { CreateEventRequestInput } from "@/types/eventRequest";
import type { UpdateEventRequestInput } from "@/services/eventRequestsDb";
import type { EoEvent } from "./types";

export interface ExecutivePortalContext {
  events: Ref<EoEvent[]>;
  approvedEvents: Ref<EoEvent[]>;
  scheduledEvents: Ref<EoEvent[]>;
  handleApprove: (id: string) => void;
  handleReject: (id: string) => void;
  handleApproveAndForward: (
    id: string,
    assignments: import("@/types/resourceOffice").ResourceAssignmentInput[],
  ) => Promise<void>;
  handleRequestRevision: (
    id: string,
    comment: string,
    attachmentFile?: File | null,
  ) => Promise<void>;
  handlePostEvent: (id: string) => void;
  handleCreateEvent: (e: EoEvent) => void;
  handleUpdateEvent: (id: string, input: UpdateEventRequestInput) => Promise<void>;
  handleCancelScheduled: (id: string, reason: string) => Promise<void>;
  submitRequest: (input: CreateEventRequestInput) => Promise<void>;
  useDb: Ref<boolean>;
}

export const executivePortalKey: InjectionKey<ExecutivePortalContext> = Symbol("executivePortal");

export function useExecutivePortal(): ExecutivePortalContext {
  const ctx = inject(executivePortalKey);
  if (!ctx) {
    throw new Error("useExecutivePortal must be used within ExecutiveLayout");
  }
  return ctx;
}
