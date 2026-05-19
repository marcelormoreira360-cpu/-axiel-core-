import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Zoom uses Server-to-Server OAuth — no disconnect needed.
export async function POST() {
  return NextResponse.redirect(new URL("/settings/integrations", process.env.NEXT_PUBLIC_APP_URL!));
}
