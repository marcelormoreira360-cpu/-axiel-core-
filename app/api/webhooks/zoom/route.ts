import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { processZoomRecordingWebhook } from "@/services/zoom-service";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/zoom
 *
 * Handles Zoom webhook events:
 *   - endpoint.url_validation  → challenge-response (required by Zoom to activate webhook)
 *   - recording.completed      → sync recording files to zoom_recordings table
 *
 * Set ZOOM_WEBHOOK_SECRET_TOKEN in env vars (Zoom App → Feature → Event Subscriptions → Secret Token).
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = body.event as string | undefined;

  // ── 1. URL Validation (Zoom requires this to activate the webhook) ──────────
  if (event === "endpoint.url_validation") {
    const plainToken = (body.payload as { plainToken?: string })?.plainToken ?? "";
    const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN ?? "";
    const encryptedToken = createHmac("sha256", secret).update(plainToken).digest("hex");
    return NextResponse.json({ plainToken, encryptedToken });
  }

  // ── 2. Validate webhook signature ──────────────────────────────────────────
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN ?? "";
  if (secret) {
    const ts        = req.headers.get("x-zm-request-timestamp") ?? "";
    const signature = req.headers.get("x-zm-signature") ?? "";
    const message   = `v0:${ts}:${rawBody}`;
    const expected  = "v0=" + createHmac("sha256", secret).update(message).digest("hex");
    if (signature !== expected) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  // ── 3. Handle recording.completed ──────────────────────────────────────────
  if (event === "recording.completed") {
    const result = await processZoomRecordingWebhook(
      body as Parameters<typeof processZoomRecordingWebhook>[0]
    );
    return NextResponse.json({ ok: result.ok, synced: result.synced });
  }

  // Ignore other events
  return NextResponse.json({ ok: true, event: event ?? "unknown" });
}
