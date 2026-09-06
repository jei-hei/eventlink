export type EventSchedulePhase = "upcoming" | "ongoing" | "completed";

function parseIsoDay(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function parseTimeToMinutes(time?: string | null): number | null {
  if (!time) return null;
  const m = time.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function getEventSchedulePhase(input: {
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  now?: Date;
}): EventSchedulePhase {
  const now = input.now ?? new Date();
  const startDay = input.startDate ? parseIsoDay(input.startDate) : null;
  const endDay = input.endDate ? parseIsoDay(input.endDate) : startDay;
  if (!startDay || !endDay) return "upcoming";

  const startDt = new Date(startDay);
  const endDt = new Date(endDay);
  const startMin = parseTimeToMinutes(input.startTime);
  const endMin = parseTimeToMinutes(input.endTime);
  if (startMin != null) startDt.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
  else startDt.setHours(0, 0, 0, 0);
  if (endMin != null) endDt.setHours(Math.floor(endMin / 60), endMin % 60, 59, 999);
  else endDt.setHours(23, 59, 59, 999);

  if (now.getTime() > endDt.getTime()) return "completed";
  if (now.getTime() < startDt.getTime()) return "upcoming";
  return "ongoing";
}
