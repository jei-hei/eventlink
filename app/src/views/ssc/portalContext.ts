import type { InjectionKey, Ref } from "vue";
import { inject } from "vue";
import type { CreateEventRequestInput } from "@/types/eventRequest";
import type { CreateStudentFeedPostInput } from "@/types/studentPost";
import type { SscEvent } from "./types";

export interface SscPortalContext {
  events: Ref<SscEvent[]>;
  approvedEvents: Ref<SscEvent[]>;
  scheduledEvents: Ref<SscEvent[]>;
  handleApprove: (id: string) => void;
  handleReject: (id: string) => void;
  handleCreateEvent: (e: SscEvent) => void;
  handlePostEvent: (id: string) => void;
  handleCreateFeedPost: (input: CreateStudentFeedPostInput) => Promise<void>;
  submitRequest?: (input: CreateEventRequestInput) => Promise<void>;
  useDb?: Ref<boolean>;
  pushToast: (title: string, description?: string, variant?: "success" | "error") => void;
}

export const sscPortalKey: InjectionKey<SscPortalContext> = Symbol("sscPortal");

export function useSscPortal(): SscPortalContext {
  const ctx = inject(sscPortalKey);
  if (!ctx) {
    throw new Error("useSscPortal must be used within SscLayout");
  }
  return ctx;
}
