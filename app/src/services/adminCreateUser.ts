import { getSupabase } from "@/lib/supabase";

export type CreatePortalUserInput = {
  role:
    | "student_officer"
    | "ssc"
    | "adviser"
    | "dean"
    | "osas"
    | "eo"
    | "gso"
    | "it_infrastructure"
    | "sports_office"
    | "admin";
  email: string;
  password: string;
  displayName: string;
  collegeId?: string | null;
  organizationId?: string | null;
};

export type UpdatePortalUserInput = {
  userId: string;
  role: CreatePortalUserInput["role"];
  email: string;
  displayName: string;
  password?: string;
  collegeId?: string | null;
  organizationId?: string | null;
};

export type CreatePortalUserResult = {
  userId: string;
  role: CreatePortalUserInput["role"];
  email: string;
};

async function invokeAdminCreateUser(body: Record<string, unknown>): Promise<CreatePortalUserResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke("admin-create-user", { body });

  const payload = data as
    | (Partial<CreatePortalUserResult> & { error?: string })
    | null;

  if (payload?.error) {
    throw new Error(payload.error);
  }

  if (error) {
    const msg = error.message || "Could not save user account.";
    const lowered = msg.toLowerCase();
    if (
      lowered.includes("failed to send a request") ||
      lowered.includes("non-2xx") ||
      lowered.includes("not found")
    ) {
      throw new Error(
        "Admin create-user function is not available. Deploy Supabase function: admin-create-user.",
      );
    }
    throw new Error(msg);
  }

  if (!payload?.userId || !payload?.role || !payload?.email) {
    throw new Error("User account was created, but the response was invalid.");
  }

  return {
    userId: payload.userId,
    role: payload.role,
    email: payload.email,
  };
}

export async function createPortalUser(input: CreatePortalUserInput): Promise<CreatePortalUserResult> {
  return invokeAdminCreateUser({
    role: input.role,
    email: input.email.trim(),
    password: input.password,
    displayName: input.displayName.trim(),
    collegeId: input.collegeId ?? null,
    organizationId: input.organizationId ?? null,
  });
}

export async function updatePortalUser(input: UpdatePortalUserInput): Promise<CreatePortalUserResult> {
  return invokeAdminCreateUser({
    userId: input.userId,
    role: input.role,
    email: input.email.trim(),
    password: input.password?.trim() || "",
    displayName: input.displayName.trim(),
    collegeId: input.collegeId ?? null,
    organizationId: input.organizationId ?? null,
  });
}
