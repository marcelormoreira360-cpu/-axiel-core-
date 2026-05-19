import { NextResponse } from "next/server";
import { buildZoomAuthUrl } from "@/services/zoom-service";
import { getCurrentUserProfile } from "@/services/user-service";

export const runtime = "nodejs";

export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return NextResponse.json({ error: "No clinic" }, { status: 401 });

  const state = Buffer.from(JSON.stringify({ clinicId: profile.clinic_id })).toString("base64url");
  return NextResponse.redirect(buildZoomAuthUrl(state));
}
