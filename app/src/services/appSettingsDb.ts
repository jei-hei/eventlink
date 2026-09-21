import { getSupabase } from "@/lib/supabase";

const SETTINGS_ID = 1;

export async function fetchRequireIsuEmail(): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("app_settings")
    .select("require_isu_email")
    .eq("id", SETTINGS_ID)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error("Application settings are not configured. Apply the latest Supabase migrations.");
  }
  return data.require_isu_email === true;
}

export async function updateRequireIsuEmail(requireIsuEmail: boolean): Promise<void> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("app_settings")
    .update({ require_isu_email: requireIsuEmail })
    .eq("id", SETTINGS_ID)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error("Could not save settings. You may not have permission to change this option.");
  }
}
