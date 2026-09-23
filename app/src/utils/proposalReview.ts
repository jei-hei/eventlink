import { ref } from "vue";
import { isPdfPath } from "@/services/eventLetterStorage";

const STORAGE_PREFIX = "eventlink:proposal-reviewed:";
const reviewTick = ref(0);

function storageKey(letterPath: string): string {
  return `${STORAGE_PREFIX}${letterPath}`;
}

export const PROPOSAL_REVIEW_HINT =
  "Open the proposal PDF and go to the last page before you can approve.";

/** True when there is no PDF, or this browser already reached the last page. */
export function isProposalReviewed(letterPath: string | null | undefined): boolean {
  void reviewTick.value;
  if (!letterPath || !isPdfPath(letterPath)) return true;
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(storageKey(letterPath)) === "1";
}

export function markProposalReviewed(letterPath: string): void {
  if (!letterPath || typeof window === "undefined") return;
  window.sessionStorage.setItem(storageKey(letterPath), "1");
  reviewTick.value += 1;
}

export function requireProposalReviewed(letterPath: string | null | undefined): boolean {
  if (isProposalReviewed(letterPath)) return true;
  window.alert(PROPOSAL_REVIEW_HINT);
  return false;
}
