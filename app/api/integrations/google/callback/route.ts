import { NextResponse } from "next/server";
import { exchangeGoogleCode, saveGoogleIntegration } from "@/services/google-calendar-service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=google_denied`);
  }

  try {
    const { clinicId } = JSON.parse(Buffer.from(state, "base64url").toString());
    const tokens = await exchangeGoogleCode(code);
    await saveGoogleIntegration(clinicId, tokens);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?success=google`);
  } catch (e) {
    console.error("Google OAuth callback error", e);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=google_failed`);
  }
}
