import { getSupabase } from "@/lib/supabase";

export type VenueRow = {
  id: string;
  name: string;
  active: boolean;
};

export async function fetchActiveVenues(): Promise<VenueRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("venues")
    .select("id, name, active")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []) as VenueRow[];
}

export async function fetchAllVenues(): Promise<VenueRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("venues")
    .select("id, name, active")
    .order("name");
  if (error) throw error;
  return (data ?? []) as VenueRow[];
}

export async function createVenue(name: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("venues").insert({ name: name.trim() });
  if (error) throw error;
}

export async function setVenueActive(id: string, active: boolean): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("venues").update({ active }).eq("id", id);
  if (error) throw error;
}
