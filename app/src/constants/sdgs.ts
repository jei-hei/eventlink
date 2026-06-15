/** UN Sustainable Development Goals (1–17). */
export type SdgOption = {
  id: number;
  title: string;
};

export const SDG_OPTIONS: SdgOption[] = [
  { id: 1, title: "No Poverty" },
  { id: 2, title: "Zero Hunger" },
  { id: 3, title: "Good Health and Well-being" },
  { id: 4, title: "Quality Education" },
  { id: 5, title: "Gender Equality" },
  { id: 6, title: "Clean Water and Sanitation" },
  { id: 7, title: "Affordable and Clean Energy" },
  { id: 8, title: "Decent Work and Economic Growth" },
  { id: 9, title: "Industry, Innovation and Infrastructure" },
  { id: 10, title: "Reduced Inequalities" },
  { id: 11, title: "Sustainable Cities and Communities" },
  { id: 12, title: "Responsible Consumption and Production" },
  { id: 13, title: "Climate Action" },
  { id: 14, title: "Life Below Water" },
  { id: 15, title: "Life on Land" },
  { id: 16, title: "Peace, Justice and Strong Institutions" },
  { id: 17, title: "Partnerships for the Goals" },
];

const byId = new Map(SDG_OPTIONS.map((s) => [s.id, s]));

export function sdgLabel(id: number): string {
  const s = byId.get(id);
  return s ? `SDG ${id}: ${s.title}` : `SDG ${id}`;
}

/** Stored in `event_requests.sdgs` (semicolon-separated). */
export function formatSdgsForStorage(selectedIds: number[]): string {
  return [...selectedIds]
    .sort((a, b) => a - b)
    .map((id) => sdgLabel(id))
    .join("; ");
}

export function parseSdgsFromStorage(value: string | undefined | null): number[] {
  if (!value?.trim()) return [];
  const ids = new Set<number>();
  for (const part of value.split(/[;,]/)) {
    const m = part.trim().match(/SDG\s*(\d{1,2})/i);
    if (m) ids.add(parseInt(m[1]!, 10));
  }
  return [...ids].sort((a, b) => a - b);
}
