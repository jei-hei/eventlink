import { ref } from "vue";
import { downloadEventLetter } from "@/services/eventLetterStorage";

type EventWithLetter = {
  id: string;
  letterPath?: string | null;
};

/** Download the original Word file uploaded with the event request (not a generated letter). */
export function useEventLetterDownload() {
  const downloadingId = ref<string | null>(null);

  async function downloadLetter(event: EventWithLetter): Promise<boolean> {
    if (!event.letterPath) {
      window.alert(
        "No Word file was uploaded with this event request. The submitter must attach a .doc or .docx when creating the request.",
      );
      return false;
    }
    downloadingId.value = event.id;
    try {
      return await downloadEventLetter(event.letterPath);
    } finally {
      downloadingId.value = null;
    }
  }

  return { downloadingId, downloadLetter };
}
