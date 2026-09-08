import { getSupabase } from "@/lib/supabase";
import type { ResourceOffice } from "@/types/resourceOffice";

export type UsageBar = { name: string; count: number };

export type OfficeResourceAnalytics = {
  venues: { total: number; active: number };
  equipment: { total: number; active: number; availableUnits: number; zeroStock: number };
  venueUsage: UsageBar[];
  equipmentUsage: UsageBar[];
  events: { assigned: number; upcoming: number; completed: number };
};

const EMPTY: OfficeResourceAnalytics = {
  venues: { total: 0, active: 0 },
  equipment: { total: 0, active: 0, availableUnits: 0, zeroStock: 0 },
  venueUsage: [],
  equipmentUsage: [],
  events: { assigned: 0, upcoming: 0, completed: 0 },
};

function asInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asBars(value: unknown): UsageBar[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      const rec = row as { name?: unknown; count?: unknown };
      return { name: String(rec.name ?? "—"), count: asInt(rec.count) };
    })
    .filter((row) => row.name);
}

export async function fetchOfficeResourceAnalytics(
  office: ResourceOffice,
): Promise<OfficeResourceAnalytics> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("office_resource_analytics", { p_office: office });
  if (error) throw error;
  const raw = (data ?? {}) as Record<string, unknown>;
  const venues = (raw.venues ?? {}) as Record<string, unknown>;
  const equipment = (raw.equipment ?? {}) as Record<string, unknown>;
  const events = (raw.events ?? {}) as Record<string, unknown>;
  return {
    venues: { total: asInt(venues.total), active: asInt(venues.active) },
    equipment: {
      total: asInt(equipment.total),
      active: asInt(equipment.active),
      availableUnits: asInt(equipment.availableUnits),
      zeroStock: asInt(equipment.zeroStock),
    },
    venueUsage: asBars(raw.venueUsage),
    equipmentUsage: asBars(raw.equipmentUsage),
    events: {
      assigned: asInt(events.assigned),
      upcoming: asInt(events.upcoming),
      completed: asInt(events.completed),
    },
  };
}

export function emptyOfficeResourceAnalytics(): OfficeResourceAnalytics {
  return structuredClone(EMPTY);
}
