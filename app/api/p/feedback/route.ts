import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import crypto from "node:crypto";

export const runtime = "nodejs";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// POST /api/p/feedback
// Patient submits NPS score + optional comment for a past session.
// Authenticated via portal token — no session cookie needed.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const { token, appointment_id, nps_score, feedback_text } = body as {
    token?: string;
    appointment_id?: string;
    nps_score?: number;
    feedback_text?: string;
  };

  if (!token || !appointment_id || nps_score === undefined) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
  }

  if (typeof nps_score !== "number" || !Number.isInteger(nps_score) || nps_score < 0 || nps_score > 10) {
    return NextResponse.json({ error: "Pontuação NPS inválida (deve ser 0-10)." }, { status: 400 });
  }

  if (feedback_text !== undefined && (typeof feedback_text !== "string" || feedback_text.length > 1000)) {
    return NextResponse.json({ error: "Comentário muito longo (máximo 1000 caracteres)." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const tokenHash = hashToken(token);

  // ── Validate portal link ──────────────────────────────────────────────────────
  const { data: link } = await supabase
    .from("patient_portal_links")
    .select("id, clinic_id, patient_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!link || link.revoked_at || new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: "Link inválido ou expirado." }, { status: 401 });
  }

  // ── Validate appointment belongs to this patient / clinic ─────────────────────
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, starts_at")
    .eq("id", appointment_id)
    .eq("patient_id", link.patient_id)
    .eq("clinic_id", link.clinic_id)
    .maybeSingle();

  if (!appointment) {
    return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
  }

  // Feedback only for appointments that have already started
  if (new Date(appointment.starts_at) > new Date()) {
    return NextResponse.json({ error: "Não é possível avaliar uma sessão futura." }, { status: 400 });
  }

  // ── Upsert feedback (allow patient to update their rating) ───────────────────
  const { error } = await supabase
    .from("session_feedback")
    .upsert(
      {
        clinic_id: link.clinic_id,
        patient_id: link.patient_id,
        appointment_id,
        nps_score,
        feedback_text: feedback_text?.trim() || null,
      },
      { onConflict: "appointment_id" },
    );

  if (error) {
    return NextResponse.json({ error: "Erro ao salvar avaliação." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
