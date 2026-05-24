import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const answerSchema = z.object({
  question_id: z.string().uuid(),
  section_id:  z.string().uuid().nullable(),
  value_number: z.number().nullable(),
  value_text:   z.string().max(5000).nullable(),
});

const submitSchema = z.object({
  token:             z.string().min(16).max(256),
  answers:           z.array(answerSchema).max(200),
  section_scores:    z.record(z.unknown()).optional().nullable(),
  total_score:       z.number().nullable().optional(),
  max_possible_score: z.number().nullable().optional(),
  notes:             z.string().max(2000).nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = submitSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }
    const { token, answers, section_scores, total_score, max_possible_score, notes } = parsed.data;

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

    const totalScore = total_score ?? 0;
    const maxScore = max_possible_score ?? 0;
    const score_percentage =
      maxScore > 0 ? Math.round((totalScore / maxScore) * 10000) / 100 : 0;

    // Create response
    const { data: response, error: rErr } = await supabase
      .from("assessment_responses")
      .insert({
        template_id: inv.template_id,
        patient_id: inv.patient_id,
        clinic_id: inv.clinic_id,
        total_score:       totalScore,
        max_possible_score: maxScore,
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
        answers.map((a) => ({
          response_id: response.id,
          question_id: a.question_id,
          score:        a.value_number ?? null,
          text_answer:  a.value_text   ?? null,
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
