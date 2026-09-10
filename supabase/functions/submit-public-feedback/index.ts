import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const baseCorsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function allowedOrigins(): Set<string> {
  return new Set(
    (Deno.env.get("ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return allowedOrigins().has(origin)
    ? { ...baseCorsHeaders, "Access-Control-Allow-Origin": origin, Vary: "Origin" }
    : baseCorsHeaders;
}

function json(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function clientKey(req: Request): Promise<string> {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ip = forwarded || req.headers.get("cf-connecting-ip") || "unknown";
  const salt = Deno.env.get("RATE_LIMIT_SALT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return sha256Hex(`${salt}:${ip}`);
}

type SubmitBody = {
  feedPostId?: unknown;
  rating?: unknown;
  comment?: unknown;
  improvementTags?: unknown;
  accessCode?: unknown;
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins().has(origin)) {
    return json(req, 403, { error: "Origin not allowed." });
  }
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return json(req, 405, { error: "Method not allowed." });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    return json(req, 500, { error: "Service unavailable." });
  }
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > 16384) {
    return json(req, 413, { error: "Request is too large." });
  }

  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return json(req, 400, { error: "Invalid JSON body." });
  }

  const feedPostId = String(body.feedPostId ?? "").trim();
  const rating = Number(body.rating);
  const comment = String(body.comment ?? "").trim();
  const accessCode = String(body.accessCode ?? "").trim();
  const improvementTags = Array.isArray(body.improvementTags)
    ? body.improvementTags.map((tag) => String(tag).trim()).filter(Boolean)
    : [];

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(feedPostId)) {
    return json(req, 400, { error: "Missing event." });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return json(req, 400, { error: "Please select a rating from 1 to 5 stars." });
  }
  if (!comment || comment.length > 1000) {
    return json(req, 400, { error: "Please choose a comment of at most 1000 characters." });
  }
  if (accessCode.length > 128 || improvementTags.length > 20 || improvementTags.some((tag) => tag.length > 80)) {
    return json(req, 400, { error: "Invalid feedback details." });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.rpc("submit_public_event_feedback_server", {
    p_feed_post_id: feedPostId,
    p_rating: rating,
    p_comment: comment,
    p_improvement_tags: improvementTags,
    p_access_code_hash: accessCode ? await sha256Hex(accessCode) : "",
    p_rate_limit_key: await clientKey(req),
  });

  if (error) {
    if (error.message?.includes("rate_limit_exceeded")) {
      return json(req, 429, { error: "Too many submissions. Please wait and try again." });
    }
    const safeMessages = [
      "Feedback opens after the linked event has finished.",
      "Incorrect access code. Feedback was not submitted.",
      "Feedback is not available for this event.",
      "Please select a rating from 1 to 5 stars.",
      "Please choose a comment of at most 1000 characters.",
    ];
    const safe = safeMessages.find((message) => error.message?.includes(message));
    if (safe) return json(req, 400, { error: safe });
    console.error("[submit-public-feedback] submission failed", error.message);
    return json(req, 500, { error: "Could not submit feedback." });
  }

  return json(req, 200, { ok: true, feedbackId: data });
});
