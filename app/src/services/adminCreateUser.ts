import { getSupabase } from "@/lib/supabase";

export type CreatePortalUserInput = {
  role: "student_officer" | "ssc" | "adviser" | "dean" | "osas" | "eo" | "gso" | "admin";
  email: string;
  password: string;
  displayName: string;
};

export type CreatePortalUserResult = {
  userId: string;
  role: CreatePortalUserInput["role"];
  email: string;
};

export async function createPortalUser(input: CreatePortalUserInput): Promise<CreatePortalUserResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke("admin-create-user", {
    body: {
      role: input.role,
      email: input.email.trim(),
      password: input.password,
      displayName: input.displayName.trim(),
    },
  });

  if (error) {
    const msg = error.message || "Could not create user account.";
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

  const payload = data as Partial<CreatePortalUserResult> | null;
  if (!payload?.userId || !payload?.role || !payload?.email) {
    throw new Error("User account was created, but the response was invalid.");
  }

  return {
    userId: payload.userId,
    role: payload.role,
    email: payload.email,
  };
}
