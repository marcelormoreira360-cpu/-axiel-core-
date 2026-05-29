import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getCurrentUserProfile } from "@/services/user-service";
import { addToWaitlist, getWaitlist } from "@/services/waitlist-service";

export const runtime = "nodejs";

// GET /api/waitlist — list waitlist for current clinic
export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const entries = await getWaitlist(profile.clinic_id);
  return NextResponse.json({ entries });
}

// POST /api/waitlist — add patient to waitlist
export async function POST(req: NextRequest) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { patientId, sessionTypeId, notes } = await req.json() as {
    patientId?: string;
    sessionTypeId?: string;
    notes?: string;
  };

  if (!patientId) return NextResponse.json({ error: "patientId obrigatório." }, { status: 400 });

  const result = await addToWaitlist({
    clinicId:      profile.clinic_id,
    patientId,
    sessionTypeId: sessionTypeId ?? null,
    notes,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });

  // Return the new entry id for the button to track
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("waitlist_entries")
    .select("id")
    .eq("clinic_id", profile.clinic_id)
    .eq("patient_id", patientId)
    .eq("status", "waiting")
    .maybeSingle();

  return NextResponse.json({ ok: true, id: data?.id ?? null });
}
