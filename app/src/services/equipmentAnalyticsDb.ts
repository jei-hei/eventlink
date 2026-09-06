import { getSupabase } from "@/lib/supabase";
import type { ResourceOffice } from "@/types/resourceOffice";

export type EquipmentAnalyticsFilters = {
  dateFrom?: string;
  dateTo?: string;
  equipmentId?: string;
  office?: ResourceOffice;
};

export type EquipmentAnalyticsSummary = {
  totalAvailableUnits: number;
  totalUnavailableUnits: number;
  zeroStockCount: number;
  activeEquipmentCount: number;
  requestCountsByStatus: Record<string, number>;
};

export async function fetchEquipmentAnalyticsSummary(
  filters: EquipmentAnalyticsFilters = {},
): Promise<EquipmentAnalyticsSummary> {
  const supabase = getSupabase();

  let equipmentQuery = supabase
    .from("equipment")
    .select("id, quantity_available, availability, status, active, responsible_office")
    .eq("active", true);

  if (filters.office) {
    equipmentQuery = equipmentQuery.eq("responsible_office", filters.office);
  }
  if (filters.equipmentId) {
    equipmentQuery = equipmentQuery.eq("id", filters.equipmentId);
  }

  const { data: equipmentRows, error: equipmentErr } = await equipmentQuery;
  if (equipmentErr) throw equipmentErr;

  const rows = equipmentRows ?? [];
  const officeEquipmentIds = new Set(rows.map((r) => String(r.id)));
  let totalAvailableUnits = 0;
  let totalUnavailableUnits = 0;
  let zeroStockCount = 0;

  for (const row of rows) {
    const qty = Math.max(0, Number(row.quantity_available ?? 0));
    const unavailable =
      row.status === "inactive" || row.availability === "unavailable" || qty <= 0;
    if (unavailable) {
      totalUnavailableUnits += qty;
      if (qty <= 0) zeroStockCount += 1;
    } else {
      totalAvailableUnits += qty;
    }
  }

  let requestQuery = supabase
    .from("event_request_equipment")
    .select(
      `
      equipment_id,
      event_requests!inner ( status, start_date, end_date )
    `,
    );

  if (filters.equipmentId) {
    requestQuery = requestQuery.eq("equipment_id", filters.equipmentId);
  }

  const { data: requestRows, error: requestErr } = await requestQuery;
  if (requestErr) throw requestErr;

  const requestCountsByStatus: Record<string, number> = {};
  for (const line of requestRows ?? []) {
    if (filters.office && !officeEquipmentIds.has(String(line.equipment_id ?? ""))) continue;
    const req = line.event_requests as { status?: string; start_date?: string; end_date?: string } | null;
    if (!req?.status) continue;
    if (filters.dateFrom && String(req.end_date ?? req.start_date) < filters.dateFrom) continue;
    if (filters.dateTo && String(req.start_date ?? req.end_date) > filters.dateTo) continue;
    requestCountsByStatus[req.status] = (requestCountsByStatus[req.status] ?? 0) + 1;
  }

  return {
    totalAvailableUnits,
    totalUnavailableUnits,
    zeroStockCount,
    activeEquipmentCount: rows.length,
    requestCountsByStatus,
  };
}

export async function fetchEquipmentOptionsForOffice(office?: ResourceOffice) {
  const supabase = getSupabase();
  let query = supabase.from("equipment").select("id, name").eq("active", true).order("name");
  if (office) query = query.eq("responsible_office", office);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; name: string }>;
}
