import { NextResponse } from "next/server";
import { buildGoogleAuthUrl } from "@/services/google-calendar-service";
import { getCurrentUserProfile } from "@/services/user-service";

export const runtime = "nodejs";

// GET /api/integrations/google — redirect to Google OAuth
export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return NextResponse.json({ error: "No clinic" }, { status: 401 });

  const state = Buffer.from(JSON.stringify({ clinicId: profile.clinic_id })).toString("base64url");
  const url   = buildGoogleAuthUrl(state);
  return NextResponse.redirect(url);
}
