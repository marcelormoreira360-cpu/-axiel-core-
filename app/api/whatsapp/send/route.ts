import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { sendWhatsAppText, formatReportForWhatsApp } from "@/services/whatsapp-service";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Resolve caller's clinic so the patient query is scoped correctly.
  const { data: profile } = await supabase
    .from("users")
    .select("clinic_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.clinic_id) {
    return NextResponse.json({ error: "Usuário sem clínica associada." }, { status: 403 });
  }

  try {
    const { patientId, report, patientName } = await req.json();
    if (!patientId || !report) {
      return NextResponse.json({ error: "patientId e report são obrigatórios" }, { status: 400 });
    }

    const { data: patient } = await supabase
      .from("patients")
      .select("full_name, phone")
      .eq("id", patientId)
      .eq("clinic_id", profile.clinic_id) // ← scope to caller's clinic
      .maybeSingle();

    if (!patient?.phone) {
      return NextResponse.json({ error: "Paciente não possui telefone cadastrado" }, { status: 400 });
    }

    const text = formatReportForWhatsApp(patientName ?? patient.full_name, report);
    await sendWhatsAppText(patient.phone, text);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("WhatsApp send error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno" },
      { status: 500 }
    );
  }
}
