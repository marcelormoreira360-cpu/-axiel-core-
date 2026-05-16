import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, answers, section_scores, total_score, max_possible_score, notes } = body;

    if (!token || !answers) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const token_hash = hashToken(token);

    // Validate invitation
    const { data: inv } = await supabase
      .from("assessment_invitations")
      .select("*")
      .eq("token_hash", token_hash)
      .maybeSingle();

    if (!inv) return NextResponse.json({ error: "Link inválido" }, { status: 404 });
    if (inv.completed_at) return NextResponse.json({ error: "Formulário já respondido" }, { status: 400 });
    if (new Date(inv.expires_at) < new Date()) return NextResponse.json({ error: "Link expirado" }, { status: 400 });

    const score_percentage =
      max_possible_score > 0 ? Math.round((total_score / max_possible_score) * 10000) / 100 : 0;

    // Create response
    const { data: response, error: rErr } = await supabase
      .from("assessment_responses")
      .insert({
        template_id: inv.template_id,
        patient_id: inv.patient_id,
        clinic_id: inv.clinic_id,
        total_score,
        max_possible_score,
        score_percentage,
        section_scores,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (rErr) throw rErr;

    // Insert answers
    if (answers.length > 0) {
      const { error: aErr } = await supabase.from("assessment_answers").insert(
        answers.map((a: {
          question_id: string;
          section_id: string | null;
          value_number: number | null;
          value_text: string | null;
        }) => ({
          response_id: response.id,
          question_id: a.question_id,
          section_id: a.section_id,
          value_number: a.value_number,
          value_text: a.value_text,
        }))
      );
      if (aErr) throw aErr;
    }

    // Mark invitation complete
    await supabase
      .from("assessment_invitations")
      .update({ completed_at: new Date().toISOString(), response_id: response.id })
      .eq("token_hash", token_hash);

    return NextResponse.json({ ok: true, response_id: response.id });
  } catch (err: unknown) {
    console.error("Form submit error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno" },
      { status: 500 }
    );
  }
}
