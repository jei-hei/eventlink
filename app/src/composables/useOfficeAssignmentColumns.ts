import { computed, ref, type Ref } from "vue";
import type { PortalEvent } from "@/types/portalEvent";
import type { ResourceOffice } from "@/types/resourceOffice";

/**
 * Venue / Equipment / EO-note cells for a resource office table. Only resources EO
 * assigned to this office are shown; another office's items never fall back in.
 */
export function useOfficeAssignmentColumns(
  office: () => ResourceOffice,
  events: Ref<PortalEvent[]>,
) {
  const expandedNotes = ref(new Set<string>());

  function pendingFor(event: PortalEvent, kind: "venue" | "equipment") {
    return (event.resourceAssignments ?? []).filter(
      (a) => a.assignedOffice === office() && a.status === "pending" && a.resourceKind === kind,
    );
  }

  function officeNote(event: PortalEvent): string {
    return event.officeNotes?.[office()] ?? "";
  }

  const hasVenue = computed(() => events.value.some((e) => pendingFor(e, "venue").length > 0));
  const hasEquipment = computed(() => events.value.some((e) => pendingFor(e, "equipment").length > 0));

  const showVenueColumn = computed(() => hasVenue.value || !hasEquipment.value);
  const showEquipmentColumn = computed(() => hasEquipment.value || !hasVenue.value);
  const showNoteColumn = computed(() => events.value.some((e) => officeNote(e) !== ""));

  function venueLabel(event: PortalEvent): string {
    return pendingFor(event, "venue").map((a) => a.resourceName).join(", ") || "—";
  }

  function equipmentLabel(event: PortalEvent): string {
    return (
      pendingFor(event, "equipment")
        .map((a) => `${a.resourceName} (x${a.quantity})`)
        .join(", ") || "—"
    );
  }

  function isNoteExpanded(eventId: string): boolean {
    return expandedNotes.value.has(eventId);
  }

  function toggleNote(eventId: string) {
    const next = new Set(expandedNotes.value);
    if (next.has(eventId)) next.delete(eventId);
    else next.add(eventId);
    expandedNotes.value = next;
  }

  return {
    showVenueColumn,
    showEquipmentColumn,
    showNoteColumn,
    venueLabel,
    equipmentLabel,
    officeNote,
    isNoteExpanded,
    toggleNote,
  };
}
