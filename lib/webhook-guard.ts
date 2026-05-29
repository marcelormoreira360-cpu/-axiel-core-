import crypto from "crypto";
import twilio from "twilio";
import { createLogger } from "@/lib/logger";

const log = createLogger("webhook-guard");

// ─── Twilio Webhook Signature Validation ─────────────────────────────────────
// Validates that incoming requests genuinely originate from Twilio.
// Reference: https://www.twilio.com/docs/usage/webhooks/webhooks-security

export function validateTwilioSignature(
  signature: string | null,
  url: string,
  params: Record<string, string>
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    log.error("TWILIO_AUTH_TOKEN not set — rejecting request (fail closed)");
    return false;
  }
  if (!signature) return false;

  try {
    return twilio.validateRequest(authToken, signature, url, params);
  } catch {
    return false;
  }
}

// ─── Meta Webhook Signature Validation ────────────────────────────────────────
// Validates X-Hub-Signature-256 header sent by Meta on every webhook POST.
// Reference: https://developers.facebook.com/docs/messenger-platform/webhooks#validate-payloads

export function validateMetaSignature(
  signature: string | null,
  rawBody: Buffer
): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    log.error("META_APP_SECRET not set — rejecting request (fail closed)");
    return false;
  }
  if (!signature) return false;

  // signature format: "sha256=<hex>"
  const [algo, hash] = signature.split("=");
  if (algo !== "sha256" || !hash) return false;

  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

// ─── In-Process Rate Limiter (fallback) ──────────────────────────────────────
// Best-effort per-instance defense. Use checkRateLimitDb() for distributed
// rate limiting across all Vercel serverless instances.

const rateLimitWindows = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  maxRequests = 30,
  windowMs = 60_000
): boolean {
  const now = Date.now();
  const timestamps = (rateLimitWindows.get(key) ?? []).filter(
    (t) => now - t < windowMs
  );
  if (timestamps.length >= maxRequests) return false;
  timestamps.push(now);
  rateLimitWindows.set(key, timestamps);
  return true;
}

// ─── Distributed Rate Limiter (Supabase-backed, M-08) ────────────────────────
// Uses an atomic SQL upsert so all Vercel instances share window counts.
// Falls back to allowing the request on DB error (fail-open) to avoid blocking
// legitimate traffic due to transient DB issues.

export async function checkRateLimitDb(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<boolean> {
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
    const supabase = createSupabaseAdminClient();

    // Align to fixed time windows (e.g. every 15 min = floor to nearest 15-min mark)
    const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();

    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: key,
      p_window_start: windowStart,
      p_max_requests: maxRequests,
    });

    if (error) {
      log.warn("DB error — failing open", { message: error.message, key });
      return true; // fail-open
    }

    // PERF-05: probabilistic cleanup (~1% of requests) so stale rows are removed
    // continuously rather than only during the daily automation run.
    if (Math.random() < 0.01) {
      const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      supabase
        .from("rate_limit_buckets")
        .delete()
        .lt("window_start", cutoff)
        .then(({ error: cleanErr }) => {
          if (cleanErr) log.warn("cleanup error", { message: cleanErr.message });
        });
    }

    return data === true;
  } catch (e) {
    log.warn("unexpected error — failing open", { error: e instanceof Error ? e.message : String(e) });
    return true; // fail-open
  }
}
