import { getSupabase } from "@/lib/supabase";

export type EquipmentRow = {
  id: string;
  name: string;
  quantity_available: number;
  active: boolean;
};

export async function fetchActiveEquipment(): Promise<EquipmentRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("equipment")
    .select("id, name, quantity_available, active")
    .eq("active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EquipmentRow[];
}

export type SaveEquipmentInput = {
  name: string;
  quantityAvailable: number;
};

export async function createEquipment(input: SaveEquipmentInput): Promise<EquipmentRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("equipment")
    .insert({
      name: input.name.trim(),
      quantity_available: Math.max(0, Math.floor(input.quantityAvailable)),
      active: true,
    })
    .select("id, name, quantity_available, active")
    .single();
  if (error) throw error;
  return data as EquipmentRow;
}

export async function updateEquipment(id: string, input: SaveEquipmentInput): Promise<EquipmentRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("equipment")
    .update({
      name: input.name.trim(),
      quantity_available: Math.max(0, Math.floor(input.quantityAvailable)),
    })
    .eq("id", id)
    .select("id, name, quantity_available, active")
    .single();
  if (error) throw error;
  return data as EquipmentRow;
}
