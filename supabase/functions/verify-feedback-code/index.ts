import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function clientKey(req: Request, feedPostId: string): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ip = forwarded || req.headers.get("cf-connecting-ip") || "unknown";
  return `${ip}:${feedPostId}`;
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
  if (!url || !serviceKey) {
    return json(500, { error: "Missing function configuration." });
  }

  let body: { feedPostId?: string; accessCode?: string };
  try {
    body = (await req.json()) as { feedPostId?: string; accessCode?: string };
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  const feedPostId = String(body.feedPostId ?? "").trim();
  const accessCode = String(body.accessCode ?? "").trim();
  if (!feedPostId) {
    return json(400, { error: "Missing event." });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: allowed, error: limitErr } = await admin.rpc("check_rate_limit", {
    p_action: "feedback_verify",
    p_key_extra: clientKey(req, feedPostId),
    p_max_attempts: 8,
    p_window_seconds: 15 * 60,
  });
  if (limitErr) {
    console.error("[verify-feedback-code] rate limit", limitErr);
  } else if (allowed === false) {
    return json(429, { error: "Too many attempts. Please wait a moment and try again." });
  }

  const { data: post, error: postErr } = await admin
    .from("student_feed_posts")
    .select("id, require_feedback_access_code")
    .eq("id", feedPostId)
    .maybeSingle();
  if (postErr) {
    console.error("[verify-feedback-code] post", postErr);
    return json(500, { error: "Could not verify access." });
  }
  if (!post) {
    return json(404, { error: "This event was not found." });
  }

  if (!post.require_feedback_access_code) {
    return json(200, { verified: true, feedPostId, requiresCode: false });
  }

  if (!accessCode) {
    return json(400, { error: "Enter the feedback access code." });
  }

  const codeHash = await sha256Hex(accessCode);
  const { data: ok, error: verifyErr } = await admin.rpc("verify_feedback_access_code", {
    p_feed_post_id: feedPostId,
    p_code_hash: codeHash,
  });
  if (verifyErr) {
    console.error("[verify-feedback-code] rpc", verifyErr);
    return json(500, { error: "Could not verify access." });
  }
  if (ok !== true) {
    return json(200, { error: "Incorrect access code.", verified: false, feedPostId });
  }

  return json(200, { verified: true, feedPostId, requiresCode: true });
});
