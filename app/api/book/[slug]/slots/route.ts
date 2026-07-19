import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/services/appointment-service";

export const runtime = "nodejs";

// GET /api/book/[slug]/slots?date=YYYY-MM-DD&session_type_id=xxx
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const sessionTypeId = searchParams.get("session_type_id");
  const practitionerId = searchParams.get("practitioner_id");

  if (!date || !sessionTypeId) {
    return NextResponse.json({ error: "Parâmetros date e session_type_id são obrigatórios." }, { status: 400 });
  }

  const result = await getAvailableSlots({ slug, date, sessionTypeId, practitionerId });

  if (!result.ok) {
    // CLINIC_NOT_FOUND / SESSION_TYPE_NOT_FOUND → 404 (mesmo status de antes)
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ slots: result.slots });
}
