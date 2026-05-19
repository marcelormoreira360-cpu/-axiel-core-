import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Zoom uses Server-to-Server OAuth — no callback needed.
export async function GET() {
  return NextResponse.redirect(new URL("/settings/integrations", process.env.NEXT_PUBLIC_APP_URL!));
}
