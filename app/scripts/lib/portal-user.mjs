import { createClient } from "@supabase/supabase-js";

export const VALID_ROLES = [
  "student_officer",
  "ssc",
  "adviser",
  "dean",
  "osas",
  "eo",
  "gso",
  "it_infrastructure",
  "sports_office",
  "admin",
];

export const ROLE_HOME = {
  student_officer: "/student-officer",
  ssc: "/ssc",
  adviser: "/adviser",
  dean: "/dean",
  osas: "/osas",
  eo: "/executive-officer",
  gso: "/gso",
  it_infrastructure: "/it-infrastructure",
  sports_office: "/sports-office",
  admin: "/admin",
};

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE URL or SUPABASE_SERVICE_ROLE_KEY in .env.seed (service role only).",
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function findUserByEmail(supabase, targetEmail) {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase()) ?? null;
}

/**
 * Create or update a portal staff account (not for student self-signup).
 */
export async function ensurePortalUser({ role, email, password, displayName }) {
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`Invalid role "${role}". Use: ${VALID_ROLES.join(", ")}`);
  }

  const supabase = getSupabaseAdmin();
  const name = displayName?.trim() || role.replace(/_/g, " ");
  let user = await findUserByEmail(supabase, email);

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { display_name: name, portal_role: role },
    });
    if (error) throw error;
    user = data.user;
  } else {
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { display_name: name, portal_role: role },
    });
    if (error) throw error;
  }

  const { error: roleErr } = await supabase.from("user_roles").upsert(
    { user_id: user.id, role },
    { onConflict: "user_id" },
  );
  if (roleErr) throw roleErr;

  const { error: profileErr } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      display_name: name,
      email: email.trim(),
    },
    { onConflict: "id" },
  );
  if (profileErr) throw profileErr;

  return {
    userId: user.id,
    role,
    email: email.trim(),
    password,
    displayName: name,
    home: ROLE_HOME[role] ?? "/login",
  };
}
