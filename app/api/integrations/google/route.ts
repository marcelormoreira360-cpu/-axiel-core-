import { NextResponse } from "next/server";
import { createHmac, randomBytes } from "crypto";
import { buildGoogleAuthUrl } from "@/services/google-calendar-service";
import { getCurrentUserProfile } from "@/services/user-service";

export const runtime = "nodejs";

// GET /api/integrations/google — redirect to Google OAuth
export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return NextResponse.json({ error: "No clinic" }, { status: 401 });

  const secret = process.env.CRON_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    console.error("Google OAuth: CRON_SECRET or SUPABASE_SERVICE_ROLE_KEY must be configured.");
    return NextResponse.json({ error: "Integração com Google não configurada. Contate o suporte." }, { status: 500 });
  }

  const nonce  = randomBytes(16).toString("hex");
  const payload = JSON.stringify({ clinicId: profile.clinic_id, userId: profile.id, nonce });
  const sig  = createHmac("sha256", secret).update(payload).digest("hex");
  const state = Buffer.from(JSON.stringify({ payload, sig })).toString("base64url");

  const url = buildGoogleAuthUrl(state);
  return NextResponse.redirect(url);
}
