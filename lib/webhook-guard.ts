import crypto from "crypto";
import twilio from "twilio";

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
    console.error("webhook-guard: TWILIO_AUTH_TOKEN not set — skipping validation");
    return true; // non-blocking in misconfiguration; log is the signal
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
    console.error("webhook-guard: META_APP_SECRET not set — skipping validation");
    return true; // non-blocking in misconfiguration; log is the signal
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

// ─── Simple In-Process Rate Limiter ───────────────────────────────────────────
// Best-effort defense against burst abuse within a single serverless instance.
// Not a substitute for an edge-level rate limiter (e.g. Vercel Firewall / Upstash).

const rateLimitWindows = new Map<string, number[]>();
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 30;  // 30 requests per minute per key

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitWindows.get(key) ?? []).filter(
    (t) => now - t < WINDOW_MS
  );
  if (timestamps.length >= MAX_REQUESTS) return false;
  timestamps.push(now);
  rateLimitWindows.set(key, timestamps);
  return true;
}
