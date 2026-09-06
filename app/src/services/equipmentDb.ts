import { getSupabase } from "@/lib/supabase";
import type { ResourceOffice } from "@/types/resourceOffice";
import {
  buildPaginatedResult,
  pageToRange,
  type PaginatedResult,
  type PaginationParams,
} from "@/types/pagination";

export type EquipmentRow = {
  id: string;
  name: string;
  description: string;
  quantity_available: number;
  responsible_office: ResourceOffice;
  availability: string;
  status: string;
  active: boolean;
};

const EQUIPMENT_SELECT =
  "id, name, description, quantity_available, responsible_office, availability, status, active";

function mapEquipment(row: Record<string, unknown>): EquipmentRow {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    quantity_available: Math.max(0, Number(row.quantity_available ?? 0)),
    responsible_office: (row.responsible_office as ResourceOffice) || "gso",
    availability: String(row.availability ?? "available"),
    status: String(row.status ?? (row.active ? "active" : "inactive")),
    active: Boolean(row.active),
  };
}

/** Active equipment for forms/pickers — capped intentionally. */
export async function fetchActiveEquipment(limit = 100): Promise<EquipmentRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("equipment")
    .select(EQUIPMENT_SELECT)
    .eq("active", true)
    .order("name", { ascending: true })
    .limit(Math.min(100, Math.max(1, limit)));
  if (error) throw error;
  return (data ?? []).map((r) => mapEquipment(r as Record<string, unknown>));
}

/** @deprecated Prefer fetchEquipmentPage for manager UIs. */
export async function fetchAllEquipment(): Promise<EquipmentRow[]> {
  const page = await fetchEquipmentPage({ page: 1, pageSize: 100 });
  return page.rows;
}

/** @deprecated Prefer fetchEquipmentPage. */
export async function fetchEquipmentForOffice(office: ResourceOffice): Promise<EquipmentRow[]> {
  const page = await fetchEquipmentPage({ page: 1, pageSize: 100, office });
  return page.rows;
}

export type EquipmentPageFilters = PaginationParams & {
  office?: ResourceOffice | null;
  search?: string;
  activeOnly?: boolean;
};

export async function fetchEquipmentPage(
  params: EquipmentPageFilters = {},
): Promise<PaginatedResult<EquipmentRow>> {
  const { page, pageSize, from, to } = pageToRange(params.page, params.pageSize);
  const supabase = getSupabase();
  let query = supabase
    .from("equipment")
    .select(EQUIPMENT_SELECT, { count: "exact" })
    .order("name", { ascending: true })
    .range(from, to);

  if (params.office) query = query.eq("responsible_office", params.office);
  if (params.activeOnly) query = query.eq("active", true);
  const q = params.search?.trim();
  if (q) {
    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return buildPaginatedResult(
    (data ?? []).map((r) => mapEquipment(r as Record<string, unknown>)),
    count ?? 0,
    page,
    pageSize,
  );
}

export type SaveEquipmentInput = {
  name: string;
  description?: string;
  quantityAvailable: number;
  responsibleOffice?: ResourceOffice;
  availability?: string;
  status?: string;
  active?: boolean;
};

export async function createEquipment(input: SaveEquipmentInput): Promise<EquipmentRow> {
  const supabase = getSupabase();
  const active = input.active ?? input.status !== "inactive";
  const { data, error } = await supabase
    .from("equipment")
    .insert({
      name: input.name.trim(),
      description: (input.description ?? "").trim(),
      quantity_available: Math.max(0, Math.floor(input.quantityAvailable)),
      responsible_office: input.responsibleOffice ?? "gso",
      availability: input.availability ?? "available",
      status: input.status ?? (active ? "active" : "inactive"),
      active,
    })
    .select(EQUIPMENT_SELECT)
    .single();
  if (error) throw error;
  return mapEquipment(data as Record<string, unknown>);
}

export async function updateEquipment(id: string, input: SaveEquipmentInput): Promise<EquipmentRow> {
  const supabase = getSupabase();
  const active = input.active ?? input.status !== "inactive";
  const patch: Record<string, unknown> = {
    name: input.name.trim(),
    description: (input.description ?? "").trim(),
    quantity_available: Math.max(0, Math.floor(input.quantityAvailable)),
    availability: input.availability ?? "available",
    status: input.status ?? (active ? "active" : "inactive"),
    active,
  };
  if (input.responsibleOffice) patch.responsible_office = input.responsibleOffice;

  const { data, error } = await supabase
    .from("equipment")
    .update(patch)
    .eq("id", id)
    .select(EQUIPMENT_SELECT)
    .single();
  if (error) throw error;
  return mapEquipment(data as Record<string, unknown>);
}
