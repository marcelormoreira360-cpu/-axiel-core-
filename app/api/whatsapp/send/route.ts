import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { sendWhatsAppText, formatReportForWhatsApp } from "@/services/whatsapp-service";

export async function POST(req: NextRequest) {
  try {
    const { patientId, report, patientName } = await req.json();
    if (!patientId || !report) {
      return NextResponse.json({ error: "patientId e report são obrigatórios" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: patient } = await supabase
      .from("patients")
      .select("full_name, phone")
      .eq("id", patientId)
      .single();

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
