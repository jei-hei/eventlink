import { getSupabase } from "@/lib/supabase";

const SETTINGS_ID = 1;

export type AppSettingsSnapshot = {
  requireIsuEmail: boolean;
  allowMultipleAccounts: boolean;
  /** False until the allow_multiple_accounts column exists on this database. */
  allowMultipleAccountsReady: boolean;
  walkthroughEnabled: boolean;
  /** False until the walkthrough_enabled column exists on this database. */
  walkthroughReady: boolean;
};

function missingMultipleAccountsColumn(message: string): boolean {
  return /allow_multiple_accounts/i.test(message);
}

function missingWalkthroughColumn(message: string): boolean {
  return /walkthrough_enabled/i.test(message);
}

export async function fetchAppSettings(): Promise<AppSettingsSnapshot> {
  const supabase = getSupabase();
  const full = await supabase
    .from("app_settings")
    .select("require_isu_email, allow_multiple_accounts, walkthrough_enabled")
    .eq("id", SETTINGS_ID)
    .maybeSingle();

  if (!full.error && full.data) {
    return {
      requireIsuEmail: full.data.require_isu_email === true,
      allowMultipleAccounts: full.data.allow_multiple_accounts === true,
      allowMultipleAccountsReady: true,
      walkthroughEnabled: full.data.walkthrough_enabled === true,
      walkthroughReady: true,
    };
  }

  if (full.error && missingWalkthroughColumn(full.error.message)) {
    const legacy = await supabase
      .from("app_settings")
      .select("require_isu_email, allow_multiple_accounts")
      .eq("id", SETTINGS_ID)
      .maybeSingle();
    if (!legacy.error && legacy.data) {
      return {
        requireIsuEmail: legacy.data.require_isu_email === true,
        allowMultipleAccounts: legacy.data.allow_multiple_accounts === true,
        allowMultipleAccountsReady: true,
        walkthroughEnabled: false,
        walkthroughReady: false,
      };
    }
    if (legacy.error && missingMultipleAccountsColumn(legacy.error.message)) {
      const requireIsuEmail = await fetchRequireIsuEmail();
      return {
        requireIsuEmail,
        allowMultipleAccounts: false,
        allowMultipleAccountsReady: false,
        walkthroughEnabled: false,
        walkthroughReady: false,
      };
    }
    if (legacy.error) throw legacy.error;
  }

  if (full.error && missingMultipleAccountsColumn(full.error.message)) {
    const requireIsuEmail = await fetchRequireIsuEmail();
    return {
      requireIsuEmail,
      allowMultipleAccounts: false,
      allowMultipleAccountsReady: false,
      walkthroughEnabled: false,
      walkthroughReady: false,
    };
  }

  if (full.error) throw full.error;
  throw new Error("Application settings are not configured. Apply the latest Supabase migrations.");
}

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

export async function fetchAllowMultipleAccounts(): Promise<boolean> {
  try {
    const settings = await fetchAppSettings();
    return settings.allowMultipleAccounts === true;
  } catch {
    return false;
  }
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

export async function updateAllowMultipleAccounts(allowMultipleAccounts: boolean): Promise<void> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("app_settings")
    .update({ allow_multiple_accounts: allowMultipleAccounts })
    .eq("id", SETTINGS_ID)
    .select("id")
    .maybeSingle();
  if (error) {
    if (missingMultipleAccountsColumn(error.message)) {
      throw new Error("Apply the latest database migration before changing this switch.");
    }
    throw error;
  }
  if (!data) {
    throw new Error("Could not save settings. You may not have permission to change this option.");
  }
}

export async function updateWalkthroughEnabled(walkthroughEnabled: boolean): Promise<void> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("app_settings")
    .update({ walkthrough_enabled: walkthroughEnabled })
    .eq("id", SETTINGS_ID)
    .select("id")
    .maybeSingle();
  if (error) {
    if (missingWalkthroughColumn(error.message)) {
      throw new Error("Apply the latest database migration before changing this switch.");
    }
    throw error;
  }
  if (!data) {
    throw new Error("Could not save settings. You may not have permission to change this option.");
  }
}
