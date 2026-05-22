import { NextResponse } from "next/server";
import { createHmac, randomBytes } from "crypto";
import { buildGoogleAuthUrl } from "@/services/google-calendar-service";
import { getCurrentUserProfile } from "@/services/user-service";

export const runtime = "nodejs";

// GET /api/integrations/google — redirect to Google OAuth
export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return NextResponse.json({ error: "No clinic" }, { status: 401 });

  const secret = process.env.CRON_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "axiel-oauth-secret";
  const nonce  = randomBytes(16).toString("hex");
  const payload = JSON.stringify({ clinicId: profile.clinic_id, nonce });
  const sig  = createHmac("sha256", secret).update(payload).digest("hex");
  const state = Buffer.from(JSON.stringify({ payload, sig })).toString("base64url");

  const url = buildGoogleAuthUrl(state);
  return NextResponse.redirect(url);
}
