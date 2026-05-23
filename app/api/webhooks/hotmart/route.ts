import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "node:crypto";
import {
  getHotmartToken,
  processHotmartWebhook,
  type HotmartWebhookPayload,
} from "@/services/hotmart-service";

/**
 * POST /api/webhooks/hotmart?clinic_id=<clinicId>
 *
 * Hotmart sends the hottok in the "x-hotmart-hottok" header.
 * The clinic_id is passed as a query param so we know which clinic
 * to associate the purchase with.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const clinicId = req.nextUrl.searchParams.get("clinic_id");
    if (!clinicId) {
      return NextResponse.json({ error: "Missing clinic_id" }, { status: 400 });
    }

    // Verify hottok
    const incomingToken =
      req.headers.get("x-hotmart-hottok") ??
      req.nextUrl.searchParams.get("hottok") ??
      "";

    const storedToken = await getHotmartToken(clinicId);
    // A-09: hash both tokens to the same fixed length before constant-time comparison
    // so timingSafeEqual never throws a length mismatch error.
    const hash = (s: string) => createHash("sha256").update(s).digest();
    const tokensMatch = storedToken
      ? timingSafeEqual(hash(incomingToken), hash(storedToken))
      : false;
    if (!tokensMatch) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json() as HotmartWebhookPayload;
    const result = await processHotmartWebhook(clinicId, body);

    return NextResponse.json(result);
  } catch (e) {
    console.error("[hotmart-webhook]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
