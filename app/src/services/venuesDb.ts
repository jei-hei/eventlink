import { getSupabase } from "@/lib/supabase";
import type { ResourceOffice } from "@/types/resourceOffice";
import {
  buildPaginatedResult,
  emptyPage,
  pageToRange,
  type PaginatedResult,
  type PaginationParams,
} from "@/types/pagination";

export type VenueRow = {
  id: string;
  name: string;
  description: string;
  location: string;
  capacity: number | null;
  responsible_office: ResourceOffice;
  availability: string;
  status: string;
  active: boolean;
};

const VENUE_SELECT =
  "id, name, description, location, capacity, responsible_office, availability, status, active";

function mapVenue(row: Record<string, unknown>): VenueRow {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    location: String(row.location ?? ""),
    capacity: row.capacity == null ? null : Number(row.capacity),
    responsible_office: (row.responsible_office as ResourceOffice) || "gso",
    availability: String(row.availability ?? "available"),
    status: String(row.status ?? (row.active ? "active" : "inactive")),
    active: Boolean(row.active),
  };
}

/** Active venues for forms/pickers — capped intentionally. */
export async function fetchActiveVenues(limit = 100): Promise<VenueRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("venues")
    .select(VENUE_SELECT)
    .eq("active", true)
    .order("name")
    .limit(Math.min(100, Math.max(1, limit)));
  if (error) throw error;
  return (data ?? []).map((r) => mapVenue(r as Record<string, unknown>));
}

/** @deprecated Prefer fetchVenuesPage for manager UIs. */
export async function fetchAllVenues(): Promise<VenueRow[]> {
  const page = await fetchVenuesPage({ page: 1, pageSize: 100 });
  return page.rows;
}

/** @deprecated Prefer fetchVenuesPage. */
export async function fetchVenuesForOffice(office: ResourceOffice): Promise<VenueRow[]> {
  const page = await fetchVenuesPage({ page: 1, pageSize: 100, office });
  return page.rows;
}

export type VenuesPageFilters = PaginationParams & {
  office?: ResourceOffice | null;
  search?: string;
  activeOnly?: boolean;
};

export async function fetchVenuesPage(params: VenuesPageFilters = {}): Promise<PaginatedResult<VenueRow>> {
  const { page, pageSize, from, to } = pageToRange(params.page, params.pageSize);
  const supabase = getSupabase();
  let query = supabase
    .from("venues")
    .select(VENUE_SELECT, { count: "exact" })
    .order("name")
    .range(from, to);

  if (params.office) query = query.eq("responsible_office", params.office);
  if (params.activeOnly) query = query.eq("active", true);
  const q = params.search?.trim();
  if (q) {
    query = query.or(`name.ilike.%${q}%,location.ilike.%${q}%,description.ilike.%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return buildPaginatedResult(
    (data ?? []).map((r) => mapVenue(r as Record<string, unknown>)),
    count ?? 0,
    page,
    pageSize,
  );
}

export type SaveVenueInput = {
  name: string;
  description?: string;
  location?: string;
  capacity?: number | null;
  responsibleOffice: ResourceOffice;
  availability?: string;
  status?: string;
  active?: boolean;
};

export async function createVenue(input: SaveVenueInput | string): Promise<VenueRow> {
  const supabase = getSupabase();
  const payload =
    typeof input === "string"
      ? {
          name: input.trim(),
          description: "",
          location: "",
          capacity: null,
          responsible_office: "gso" as ResourceOffice,
          availability: "available",
          status: "active",
          active: true,
        }
      : {
          name: input.name.trim(),
          description: (input.description ?? "").trim(),
          location: (input.location ?? "").trim(),
          capacity: input.capacity == null ? null : Math.max(0, Math.floor(input.capacity)),
          responsible_office: input.responsibleOffice,
          availability: input.availability ?? "available",
          status: input.status ?? "active",
          active: input.active ?? input.status !== "inactive",
        };

  const { data, error } = await supabase.from("venues").insert(payload).select(VENUE_SELECT).single();
  if (error) throw error;
  return mapVenue(data as Record<string, unknown>);
}

export async function updateVenue(id: string, input: SaveVenueInput): Promise<VenueRow> {
  const supabase = getSupabase();
  const active = input.active ?? input.status !== "inactive";
  const { data, error } = await supabase
    .from("venues")
    .update({
      name: input.name.trim(),
      description: (input.description ?? "").trim(),
      location: (input.location ?? "").trim(),
      capacity: input.capacity == null ? null : Math.max(0, Math.floor(input.capacity)),
      responsible_office: input.responsibleOffice,
      availability: input.availability ?? "available",
      status: input.status ?? (active ? "active" : "inactive"),
      active,
    })
    .eq("id", id)
    .select(VENUE_SELECT)
    .single();
  if (error) throw error;
  return mapVenue(data as Record<string, unknown>);
}

export async function setVenueActive(id: string, active: boolean): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("venues")
    .update({
      active,
      status: active ? "active" : "inactive",
      availability: active ? "available" : "unavailable",
    })
    .eq("id", id);
  if (error) throw error;
}
