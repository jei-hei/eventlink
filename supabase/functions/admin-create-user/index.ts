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
  userId?: string;
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
  const requestedUserId = String(body.userId ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const displayName = String(body.displayName ?? "").trim();
  const collegeId = String(body.collegeId ?? "").trim();
  const organizationId = String(body.organizationId ?? "").trim();

  if (!validRoles.has(role)) {
    return json(400, { error: "Invalid role selected." });
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

  let existing: { id: string; email?: string | null } | null = null;

  if (requestedUserId) {
    const { data: existingById, error: byIdErr } = await admin.auth.admin.getUserById(requestedUserId);
    if (byIdErr) return json(500, { error: byIdErr.message });
    if (!existingById.user) return json(404, { error: "Target user not found." });
    existing = existingById.user;
  } else {
    if (!email || !email.includes("@")) {
      return json(400, { error: "A valid email is required." });
    }
    const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) {
      return json(500, { error: listErr.message });
    }
    existing = usersPage.users.find((u) => (u.email ?? "").toLowerCase() === email) ?? null;
  }

  if (!existing && password.length < 8) {
    return json(400, { error: "Password must be at least 8 characters." });
  }
  if (existing && password && password.length < 8) {
    return json(400, { error: "If provided, password must be at least 8 characters." });
  }

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

  if (role === "dean" && collegeId) {
    const { data: deanRoles, error: deanRoleErr } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "dean");
    if (deanRoleErr) return json(500, { error: deanRoleErr.message });
    const deanIds = (deanRoles ?? [])
      .map((r) => r.user_id as string)
      .filter((id) => id && id !== existingUserId);
    if (deanIds.length) {
      const { data: existingDean, error: deanProfileErr } = await admin
        .from("profiles")
        .select("id, display_name")
        .in("id", deanIds)
        .eq("college_id", collegeId)
        .limit(1)
        .maybeSingle();
      if (deanProfileErr) return json(500, { error: deanProfileErr.message });
      if (existingDean?.id) {
        return json(409, { error: "This college already has a registered Dean." });
      }
    }
  }

  let userId = existing?.id ?? "";
  if (!existing) {
    // email_confirm: true → account is immediately login-ready (no confirmation link).
    // Required for Admin-created / dummy test emails during development.
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
    const effectiveEmail = email || (existing.email ?? "").toLowerCase();
    if (!effectiveEmail || !effectiveEmail.includes("@")) {
      return json(400, { error: "User email is missing or invalid." });
    }
    const updatePayload: {
      password?: string;
      email?: string;
      email_confirm: boolean;
      user_metadata: { display_name: string; portal_role: string };
    } = {
      email_confirm: true,
      user_metadata: { display_name: displayName, portal_role: role },
    };
    if (password) updatePayload.password = password;
    if (email && email !== (existing.email ?? "").toLowerCase()) {
      updatePayload.email = email;
    }
    const { error: updateErr } = await admin.auth.admin.updateUserById(existing.id, updatePayload);
    if (updateErr) {
      return json(500, { error: updateErr.message });
    }
    userId = existing.id;
  }

  const finalEmail = email || ((existing?.email ?? "").toLowerCase());
  if (!finalEmail || !finalEmail.includes("@")) {
    return json(400, { error: "User email is missing or invalid." });
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
      email: finalEmail,
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
    email: finalEmail,
  });
});
