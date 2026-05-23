import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { exchangeGoogleCode, saveGoogleIntegration } from "@/services/google-calendar-service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl}/settings/integrations?error=google_denied`);
  }

  try {
    const secret = process.env.CRON_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) {
      console.error("Google OAuth callback: CRON_SECRET or SUPABASE_SERVICE_ROLE_KEY must be configured.");
      return NextResponse.redirect(`${appUrl}/settings/integrations?error=google_config_error`);
    }
    const { payload, sig } = JSON.parse(Buffer.from(state, "base64url").toString()) as {
      payload: string;
      sig: string;
    };

    // ── CSRF: verify HMAC signature ─────────────────────────────────────────
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    if (sig !== expected) {
      console.error("Google OAuth callback: invalid state signature — possible CSRF");
      return NextResponse.redirect(`${appUrl}/settings/integrations?error=google_invalid_state`);
    }

    const { clinicId } = JSON.parse(payload) as { clinicId: string };
    const tokens = await exchangeGoogleCode(code);
    await saveGoogleIntegration(clinicId, tokens);
    return NextResponse.redirect(`${appUrl}/settings/integrations?success=google`);
  } catch (e) {
    console.error("Google OAuth callback error", e);
    return NextResponse.redirect(`${appUrl}/settings/integrations?error=google_failed`);
  }
}
