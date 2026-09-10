import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const baseCorsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SendBody = {
  notificationId?: string;
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
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("NOTIFICATION_FROM_EMAIL");
  const authHeader = req.headers.get("Authorization");
  const accessToken = authHeader?.replace("Bearer ", "").trim();

  if (!url || !anonKey || !serviceKey || !accessToken) {
    return json(req, 401, { error: "Unauthorized." });
  }
  if (!resendKey || !fromEmail) {
    return json(req, 500, { error: "Email service unavailable." });
  }
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > 2048) {
    return json(req, 413, { error: "Request is too large." });
  }

  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const {
    data: { user },
    error: authErr,
  } = await authClient.auth.getUser();
  if (authErr || !user) {
    return json(req, 401, { error: "Unauthorized." });
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: SendBody;
  try {
    body = (await req.json()) as SendBody;
  } catch {
    return json(req, 400, { error: "Invalid JSON body." });
  }

  const notificationId = String(body.notificationId ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(notificationId)) {
    return json(req, 400, { error: "Valid notification is required." });
  }

  const { data: claimed, error: claimErr } = await admin.rpc("claim_notification_email_delivery", {
    p_notification_id: notificationId,
    p_initiator_id: user.id,
  });
  if (claimErr) {
    console.error("[send-notification-email] claim failed", claimErr.message);
    return json(req, 500, { error: "Could not process notification email." });
  }
  const message = Array.isArray(claimed) ? claimed[0] : claimed;
  if (!message) {
    return json(req, 200, { ok: true, skipped: true });
  }

  let delivered = false;
  let errorCode: "network_error" | "provider_error" | null = null;
  let providerStatus: number | null = null;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `eventlink-notification-${notificationId}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [message.recipient_email],
        subject: String(message.email_subject).slice(0, 160),
        text: String(message.email_text).slice(0, 4000),
      }),
    });
    delivered = res.ok;
    providerStatus = res.status;
    if (!delivered) errorCode = "provider_error";
  } catch (error) {
    errorCode = "network_error";
    console.error(
      "[send-notification-email] network failure",
      error instanceof Error ? error.name : "unknown",
    );
  }

  const { error: finishErr } = await admin.rpc("finish_notification_email_delivery", {
    p_notification_id: notificationId,
    p_sent: delivered,
    p_error_code: errorCode,
  });
  if (finishErr) {
    console.error("[send-notification-email] completion failed", finishErr.message);
  }
  if (!delivered) {
    if (providerStatus !== null) {
      console.error("[send-notification-email] provider rejected request", providerStatus);
    }
    return json(req, 502, { error: "Email delivery failed." });
  }

  return json(req, 200, { ok: true });
});
