import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SendBody = {
  to?: string;
  subject?: string;
  text?: string;
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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("NOTIFICATION_FROM_EMAIL");
  const authHeader = req.headers.get("Authorization");
  const accessToken = authHeader?.replace("Bearer ", "").trim();

  if (!url || !anonKey || !accessToken) {
    return json(500, { error: "Missing function configuration or auth token." });
  }
  if (!resendKey || !fromEmail) {
    return json(500, { error: "Missing email provider secrets (RESEND_API_KEY, NOTIFICATION_FROM_EMAIL)." });
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
    return json(401, { error: "Unauthorized." });
  }

  let body: SendBody;
  try {
    body = (await req.json()) as SendBody;
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  const to = String(body.to ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const text = String(body.text ?? "").trim();
  if (!to || !to.includes("@")) {
    return json(400, { error: "Valid recipient email is required." });
  }
  if (!subject) {
    return json(400, { error: "Subject is required." });
  }
  if (!text) {
    return json(400, { error: "Text body is required." });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const details = await res.text();
    return json(502, { error: `Email provider error: ${details}` });
  }

  return json(200, { ok: true });
});
