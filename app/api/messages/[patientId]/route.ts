import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendPatientMessageAlert } from "@/services/email-service";

export const runtime = "nodejs";

// ── Shared auth helper ────────────────────────────────────────────────────────
async function resolveClinicId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("clinic_id")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.clinic_id ?? null;
}

// ── GET /api/messages/[patientId] ────────────────────────────────────────────
// Fetch full conversation + mark patient→clinic messages as read.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ patientId: string }> }
) {
  const { patientId } = await params;
  const clinicId = await resolveClinicId();
  if (!clinicId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseAdminClient();

  // Verify patient belongs to this clinic
  const { data: patient } = await supabase
    .from("patients")
    .select("id, full_name")
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!patient) return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });

  // Fetch conversation
  const { data: messages, error } = await supabase
    .from("portal_messages")
    .select("id, direction, body, read_at, created_by, created_at")
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: "Erro ao buscar mensagens." }, { status: 500 });

  // Mark unread patient→clinic messages as read
  const unreadPatientIds = (messages ?? [])
    .filter((m) => m.direction === "patient_to_clinic" && !m.read_at)
    .map((m) => m.id);

  if (unreadPatientIds.length > 0) {
    await supabase
      .from("portal_messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadPatientIds);
  }

  return NextResponse.json({ messages: messages ?? [], patientName: patient.full_name });
}

// ── POST /api/messages/[patientId] ───────────────────────────────────────────
// Clinic staff sends a message to the patient.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ patientId: string }> }
) {
  const { patientId } = await params;
  const clinicId = await resolveClinicId();
  if (!clinicId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const text = typeof body.message === "string" ? body.message.trim() : "";
  if (!text || text.length > 2000) {
    return NextResponse.json({ error: "Mensagem inválida (1–2000 caracteres)." }, { status: 422 });
  }

  const supabase = createSupabaseAdminClient();

  // Verify patient ownership
  const { data: patient } = await supabase
    .from("patients")
    .select("id")
    .eq("id", patientId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!patient) return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });

  // Get the authenticated user id for created_by
  const serverSupabase = await createSupabaseServerClient();
  const { data: { user } } = await serverSupabase.auth.getUser();

  const { data: inserted, error } = await supabase
    .from("portal_messages")
    .insert({
      clinic_id:  clinicId,
      patient_id: patientId,
      direction:  "clinic_to_patient",
      body:       text,
      created_by: user?.id ?? null,
    })
    .select("id, direction, body, read_at, created_by, created_at")
    .single();

  if (error) return NextResponse.json({ error: "Erro ao enviar mensagem." }, { status: 500 });

  // ── Email patient if they have email + active portal link ─────────────────
  const { data: patientWithEmail } = await supabase
    .from("patients")
    .select("full_name, email")
    .eq("id", patientId)
    .maybeSingle();

  if (patientWithEmail?.email) {
    const { data: clinic } = await supabase
      .from("clinics")
      .select("name")
      .eq("id", clinicId)
      .maybeSingle();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    // We can't expose the raw token from hash — link to the portal root; patient already has the link
    // portalUrl is intentionally undefined — we don't have the raw token to reconstruct it.
    // The patient uses their existing link (sent via WhatsApp/email when the portal was created).
    void sendPatientMessageAlert({
      to: patientWithEmail.email as string,
      patientFirstName: (patientWithEmail.full_name as string).split(" ")[0],
      clinicName: (clinic?.name as string | null) ?? "Sua clínica",
      messagePreview: text,
    });
  }

  return NextResponse.json({ message: inserted }, { status: 201 });
}
