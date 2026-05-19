import { NextResponse } from "next/server";
import { disconnectZoom } from "@/services/zoom-service";
import { getCurrentUserProfile } from "@/services/user-service";

export const runtime = "nodejs";

export async function POST() {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await disconnectZoom(profile.clinic_id);
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?success=zoom_disconnected`);
}
