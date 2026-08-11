/** Matches Postgres `public.resource_office`. */
export type ResourceOffice = "gso" | "it_infrastructure" | "sports_office" | "ssc";

export type ResourceKind = "venue" | "equipment";

export type ResourceAssignmentStatus = "pending" | "approved" | "declined";

export const VENUE_OFFICES: ResourceOffice[] = ["gso", "sports_office", "ssc"];
export const EQUIPMENT_OFFICES: ResourceOffice[] = ["gso", "it_infrastructure", "ssc"];

export const RESOURCE_OFFICE_LABEL: Record<ResourceOffice, string> = {
  gso: "GSO",
  it_infrastructure: "IT Infrastructure",
  sports_office: "Sports Office",
  ssc: "SSC Venue Manager",
};

export function resourceOfficeLabel(office: ResourceOffice | string): string {
  return RESOURCE_OFFICE_LABEL[office as ResourceOffice] ?? office;
}

export type ResourceAssignmentInput = {
  resourceKind: ResourceKind;
  venueId?: string | null;
  equipmentId?: string | null;
  resourceName: string;
  quantity: number;
  assignedOffice: ResourceOffice;
};

export type EventResourceAssignmentRow = {
  id: string;
  request_id: string;
  resource_kind: ResourceKind;
  venue_id: string | null;
  equipment_id: string | null;
  resource_name: string;
  quantity: number;
  assigned_office: ResourceOffice;
  status: ResourceAssignmentStatus;
  assigned_by: string | null;
  assigned_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decline_reason: string | null;
};
