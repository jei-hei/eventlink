import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const validRoles = new Set([
  "student_officer",
  "ssc",
  "adviser",
  "dean",
  "osas",
  "eo",
  "gso",
  "admin",
]);

const singletonRoles = new Set(["osas", "eo", "gso"]);

type CreateUserBody = {
  role?: string;
  email?: string;
  password?: string;
  displayName?: string;
  collegeId?: string | null;
  organizationId?: string | null;
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authHeader = req.headers.get("Authorization");
  const accessToken = authHeader?.replace("Bearer ", "").trim();

  if (!url || !serviceKey || !anonKey || !accessToken) {
    return json(500, { error: "Missing function configuration or auth token." });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user: requester },
    error: authErr,
  } = await authClient.auth.getUser();
  if (authErr || !requester) {
    return json(401, { error: "Unauthorized." });
  }

  const { data: roleRow, error: roleErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", requester.id)
    .maybeSingle();
  if (roleErr || roleRow?.role !== "admin") {
    return json(403, { error: "Only admin users can create portal accounts." });
  }

  let body: CreateUserBody;
  try {
    body = (await req.json()) as CreateUserBody;
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  const role = String(body.role ?? "").trim().toLowerCase();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const displayName = String(body.displayName ?? "").trim();
  const collegeId = String(body.collegeId ?? "").trim();
  const organizationId = String(body.organizationId ?? "").trim();

  if (!validRoles.has(role)) {
    return json(400, { error: "Invalid role selected." });
  }
  if (!email || !email.includes("@")) {
    return json(400, { error: "A valid email is required." });
  }
  if (password.length < 8) {
    return json(400, { error: "Password must be at least 8 characters." });
  }
  if (!displayName) {
    return json(400, { error: "Display name is required." });
  }
  const needsCollege = role === "dean" || role === "adviser" || role === "student_officer";
  const needsOrganization = role === "adviser" || role === "student_officer";
  if (needsCollege && !collegeId) {
    return json(400, { error: "College is required for this role." });
  }
  if (needsOrganization && !organizationId) {
    return json(400, { error: "Organization is required for this role." });
  }

  if (collegeId) {
    const { data: collegeRow, error: collegeErr } = await admin
      .from("colleges")
      .select("id")
      .eq("id", collegeId)
      .maybeSingle();
    if (collegeErr) return json(500, { error: collegeErr.message });
    if (!collegeRow) return json(400, { error: "Selected college was not found." });
  }

  if (organizationId) {
    const { data: orgRow, error: orgErr } = await admin
      .from("organizations")
      .select("id, college_id")
      .eq("id", organizationId)
      .maybeSingle();
    if (orgErr) return json(500, { error: orgErr.message });
    if (!orgRow) return json(400, { error: "Selected organization was not found." });
    if (collegeId && orgRow.college_id !== collegeId) {
      return json(400, { error: "Selected organization does not belong to the selected college." });
    }
  }

  const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) {
    return json(500, { error: listErr.message });
  }
  const existing = usersPage.users.find((u) => (u.email ?? "").toLowerCase() === email) ?? null;
  const existingUserId = existing?.id ?? null;

  if (singletonRoles.has(role)) {
    let singletonQuery = admin.from("user_roles").select("user_id").eq("role", role).limit(1);
    if (existingUserId) {
      singletonQuery = singletonQuery.neq("user_id", existingUserId);
    }
    const { data: existingRole, error: singletonErr } = await singletonQuery.maybeSingle();
    if (singletonErr) {
      return json(500, { error: singletonErr.message });
    }
    if (existingRole?.user_id) {
      return json(409, { error: `Only one ${role.toUpperCase()} account is allowed.` });
    }
  }

  let userId = existing?.id ?? "";
  if (!existing) {
    const { data: createData, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName, portal_role: role },
    });
    if (createErr || !createData.user) {
      return json(500, { error: createErr?.message ?? "Failed to create auth user." });
    }
    userId = createData.user.id;
  } else {
    const { error: updateErr } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName, portal_role: role },
    });
    if (updateErr) {
      return json(500, { error: updateErr.message });
    }
    userId = existing.id;
  }

  const { error: roleUpsertErr } = await admin
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id" });
  if (roleUpsertErr) {
    return json(500, { error: roleUpsertErr.message });
  }

  const { error: profileUpsertErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      display_name: displayName,
      email,
      college_id: collegeId || null,
      organization_id: organizationId || null,
    },
    { onConflict: "id" },
  );
  if (profileUpsertErr) {
    return json(500, { error: profileUpsertErr.message });
  }

  return json(200, {
    userId,
    role,
    email,
  });
});
