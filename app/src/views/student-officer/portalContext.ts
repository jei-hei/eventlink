import type { InjectionKey, Ref } from "vue";
import { inject } from "vue";
import type { CreateEventRequestInput } from "@/types/eventRequest";
import type { CreateStudentFeedPostInput } from "@/types/studentPost";
import type { OfficerEvent } from "./types";

export interface OfficerPortalContext {
  events: Ref<OfficerEvent[]>;
  approvedEvents: Ref<OfficerEvent[]>;
  scheduledEvents: Ref<OfficerEvent[]>;
  handleApprove: (id: string) => void;
  handleReject: (id: string) => void;
  handleCreateEvent: (e: OfficerEvent) => void;
  handlePostEvent: (id: string) => void;
  handleCreateFeedPost: (input: CreateStudentFeedPostInput) => Promise<void>;
  pushToast?: (title: string, description?: string, variant?: "success" | "error") => void;
  submitRequest?: (input: CreateEventRequestInput) => Promise<void>;
  useDb?: Ref<boolean>;
}

export const officerPortalKey: InjectionKey<OfficerPortalContext> = Symbol("officerPortal");

export function useOfficerPortal(): OfficerPortalContext {
  const ctx = inject(officerPortalKey);
  if (!ctx) {
    throw new Error("useOfficerPortal must be used within OfficerLayout");
  }
  return ctx;
}
