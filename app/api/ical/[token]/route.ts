import { NextResponse } from "next/server";
import { getClinicByIcalToken, generateIcalFeed } from "@/services/ical-service";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const clinic = await getClinicByIcalToken(token);
  if (!clinic) return new NextResponse("Not found", { status: 404 });

  const ical = await generateIcalFeed(clinic.id, clinic.name);

  return new NextResponse(ical, {
    headers: {
      "Content-Type":        "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${clinic.name.replace(/\s/g, "_")}.ics"`,
      "Cache-Control":       "no-cache, no-store",
    },
  });
}
