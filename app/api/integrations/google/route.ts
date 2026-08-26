import { NextResponse } from "next/server";
import { createHmac, randomBytes } from "crypto";
import { buildGoogleAuthUrl } from "@/services/google-calendar-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { createLogger } from "@/lib/logger";

const log = createLogger("google-oauth");

export const runtime = "nodejs";

// GET /api/integrations/google — redirect to Google OAuth
export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return NextResponse.json({ error: "No clinic" }, { status: 401 });

  // SEC (S1): usa um segredo DEDICADO para assinar o state (CSRF), não a chave
  // service-role do banco. Reusar a "crown jewel" como segredo de assinatura
  // acopla dois domínios de confiança e complica a rotação. Fail-closed se ausente.
  const secret = process.env.OAUTH_STATE_SECRET ?? process.env.CRON_SECRET;
  if (!secret) {
    log.error("OAUTH_STATE_SECRET (ou CRON_SECRET) precisa estar configurado para a integração Google.");
    return NextResponse.json({ error: "Integração com Google não configurada. Contate o suporte." }, { status: 500 });
  }

  const nonce  = randomBytes(16).toString("hex");
  const payload = JSON.stringify({ clinicId: profile.clinic_id, userId: profile.id, nonce });
  const sig  = createHmac("sha256", secret).update(payload).digest("hex");
  const state = Buffer.from(JSON.stringify({ payload, sig })).toString("base64url");

  const url = buildGoogleAuthUrl(state);
  return NextResponse.redirect(url);
}
