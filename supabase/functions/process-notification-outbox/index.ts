import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type OutboxMessage = {
  notification_id: string;
  recipient_email: string;
  email_subject: string;
  email_text: string;
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return mismatch === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed." });
  }
  if (req.headers.get("origin")) {
    return json(403, { error: "Browser requests are not allowed." });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("NOTIFICATION_FROM_EMAIL");
  const workerSecret = Deno.env.get("OUTBOX_WORKER_SECRET");
  const suppliedSecret = req.headers.get("x-outbox-secret") ?? "";

  if (!url || !serviceKey || !resendKey || !fromEmail || !workerSecret) {
    return json(500, { error: "Service unavailable." });
  }
  if (!constantTimeEqual(suppliedSecret, workerSecret)) {
    return json(401, { error: "Unauthorized." });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error: claimError } = await admin.rpc("claim_notification_email_batch", {
    p_limit: 25,
  });
  if (claimError) {
    console.error("[process-notification-outbox] claim failed", claimError.message);
    return json(500, { error: "Could not process notification outbox." });
  }

  const messages = (Array.isArray(data) ? data : []) as OutboxMessage[];
  let sent = 0;
  let failed = 0;

  await Promise.all(messages.map(async (message) => {
    let delivered = false;
    let errorCode: "network_error" | "provider_error" | null = null;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `eventlink-notification-${message.notification_id}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [message.recipient_email],
          subject: String(message.email_subject).slice(0, 160),
          text: String(message.email_text).slice(0, 4000),
        }),
      });
      delivered = response.ok;
      if (!delivered) {
        errorCode = "provider_error";
        console.error(
          "[process-notification-outbox] provider rejected request",
          message.notification_id,
          response.status,
        );
      }
    } catch (error) {
      errorCode = "network_error";
      console.error(
        "[process-notification-outbox] network failure",
        message.notification_id,
        error instanceof Error ? error.name : "unknown",
      );
    }

    const { error: finishError } = await admin.rpc("finish_notification_email_delivery", {
      p_notification_id: message.notification_id,
      p_sent: delivered,
      p_error_code: errorCode,
    });
    if (finishError) {
      console.error(
        "[process-notification-outbox] completion failed",
        message.notification_id,
        finishError.message,
      );
    }
    if (delivered) sent += 1;
    else failed += 1;
  }));

  return json(200, { ok: true, claimed: messages.length, sent, failed });
});
