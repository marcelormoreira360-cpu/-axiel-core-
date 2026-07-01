import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { checkRateLimitDb } from "@/lib/webhook-guard";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

const answerSchema = z.object({
  question_id: z.string().uuid(),
  section_id:  z.string().uuid().nullable(),
  value_number: z.number().nullable(),
  value_text:   z.string().max(5000).nullable(),
});

// Cadastro do futuro paciente (só em link público de captação).
const contactSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  email:     z.string().trim().max(200).nullable().optional(),
  phone:     z.string().trim().max(40).nullable().optional(),
  consent:   z.boolean(),
  // honeypot anti-bot: campo invisível que deve chegar vazio
  website:   z.string().max(0).optional(),
});

const submitSchema = z.object({
  token:             z.string().min(16).max(256),
  answers:           z.array(answerSchema).max(200),
  section_scores:    z.record(z.unknown()).optional().nullable(),
  total_score:       z.number().nullable().optional(),
  max_possible_score: z.number().nullable().optional(),
  notes:             z.string().max(2000).nullable().optional(),
  contact:           contactSchema.nullable().optional(),
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = submitSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }
    const { token, answers, section_scores, total_score, max_possible_score, notes, contact } = parsed.data;

    const supabase = createSupabaseAdminClient();
    const token_hash = hashToken(token);

    // Validate invitation
    const { data: inv } = await supabase
      .from("assessment_invitations")
      .select("*")
      .eq("token_hash", token_hash)
      .maybeSingle();

    if (!inv) return NextResponse.json({ error: "Link inválido" }, { status: 404 });
    if (new Date(inv.expires_at) < new Date()) return NextResponse.json({ error: "Link expirado" }, { status: 400 });

    const isPublic = inv.kind === "public";

    const totalScore = total_score ?? 0;
    const maxScore = max_possible_score ?? 0;
    const score_percentage =
      maxScore > 0 ? Math.round((totalScore / maxScore) * 10000) / 100 : 0;

    // ── Link PÚBLICO de captação: cria/atualiza um Lead e guarda a submissão ──
    if (isPublic) {
      // Honeypot: se preenchido, é bot — finge sucesso e ignora.
      if (contact?.website) return NextResponse.json({ ok: true });

      if (!contact || !contact.consent || !contact.full_name?.trim()) {
        return NextResponse.json({ error: "Dados de cadastro obrigatórios" }, { status: 400 });
      }

      // Link reutilizável → rate limit por IP (não por token).
      const ip = getClientIp(req);
      if (!(await checkRateLimitDb(`public-form:${ip}`, 15, 60 * 60_000))) {
        return NextResponse.json(
          { error: "Muitas tentativas. Tente novamente mais tarde." },
          { status: 429 },
        );
      }

      const email = contact.email?.trim().toLowerCase() || null;
      if (email && !EMAIL_RE.test(email)) {
        return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
      }
      const phone = contact.phone ? (contact.phone.replace(/\D/g, "") || contact.phone.trim()) : null;

      // Nome do questionário para uma nota legível no lead.
      const { data: tpl } = await supabase
        .from("assessment_templates")
        .select("name")
        .eq("id", inv.template_id)
        .maybeSingle();
      const tplName = tpl?.name ?? "Questionário";

      // Resumo por seção (aparece nas notas do lead).
      const sectionLines: string[] = [];
      if (section_scores && typeof section_scores === "object") {
        for (const s of Object.values(section_scores as Record<string, unknown>)) {
          const sec = s as { title?: string; score?: number; max?: number };
          if (sec?.title) sectionLines.push(`• ${sec.title}: ${sec.score ?? 0}/${sec.max ?? 0}`);
        }
      }
      const noteSummary =
        `Origem: link público — "${tplName}".\n` +
        `Pontuação: ${totalScore}/${maxScore} (${score_percentage}%).` +
        (sectionLines.length ? `\n${sectionLines.join("\n")}` : "") +
        (notes?.trim() ? `\nObservação do paciente: ${notes.trim()}` : "");

      // Dedup: reaproveita lead da clínica com o mesmo e-mail.
      let leadId: string | null = null;
      if (email) {
        const { data: existingLead } = await supabase
          .from("leads")
          .select("id")
          .eq("clinic_id", inv.clinic_id)
          .eq("email", email)
          .limit(1)
          .maybeSingle();
        leadId = existingLead?.id ?? null;
      }

      if (leadId) {
        await supabase
          .from("leads")
          .update({
            full_name: contact.full_name.trim(),
            phone: phone ?? undefined,
            notes: noteSummary,
            updated_at: new Date().toISOString(),
          })
          .eq("id", leadId);
      } else {
        const { data: lead, error: lErr } = await supabase
          .from("leads")
          .insert({
            clinic_id: inv.clinic_id,
            full_name: contact.full_name.trim(),
            email,
            phone,
            source: "public_form",
            stage: "new_lead",
            main_complaint: null,
            notes: noteSummary,
          })
          .select("id")
          .single();
        if (lErr) throw lErr;
        leadId = lead.id;
      }

      // Guarda a submissão completa (respostas + score + consentimento).
      const ua = req.headers.get("user-agent")?.slice(0, 300) ?? null;
      const { error: sErr } = await supabase.from("public_form_submissions").insert({
        clinic_id: inv.clinic_id,
        template_id: inv.template_id,
        invitation_id: inv.id,
        lead_id: leadId,
        full_name: contact.full_name.trim(),
        email,
        phone,
        consent_ip: ip === "unknown" ? null : ip,
        consent_user_agent: ua,
        answers,
        section_scores,
        total_score: totalScore,
        max_possible_score: maxScore,
        score_percentage,
        notes: notes ?? null,
      });
      if (sErr) throw sErr;

      // Não marca o convite como "completo" (é reutilizável) e não gera Bio³
      // (não há paciente ainda — isso acontece na conversão do lead).
      return NextResponse.json({ ok: true, lead_id: leadId });
    }

    // ── Link de PACIENTE (fluxo original) ────────────────────────────────────
    // Rate limit: 5 tentativas por token por 15 min (proteção contra brute-force).
    if (!(await checkRateLimitDb(`form-submit:${token_hash}`, 5, 15 * 60_000))) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em alguns minutos." },
        { status: 429 },
      );
    }

    if (inv.completed_at) return NextResponse.json({ error: "Formulário já respondido" }, { status: 400 });

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

    // Insert answers — colunas reais: section_id, value_number, value_text
    if (answers.length > 0) {
      const { error: aErr } = await supabase.from("assessment_answers").insert(
        answers.map((a) => ({
          response_id:  response.id,
          question_id:  a.question_id,
          section_id:   a.section_id   ?? null,
          value_number: a.value_number ?? null,
          value_text:   a.value_text   ?? null,
        }))
      );
      if (aErr) throw aErr;
    }

    // Mark invitation complete
    await supabase
      .from("assessment_invitations")
      .update({ completed_at: new Date().toISOString(), response_id: response.id })
      .eq("token_hash", token_hash);

    // Auto-gerar/atualizar o Mapa Bio³ (rascunho parcial) se o template estiver
    // mapeado. Silencioso e não pode derrubar o submit do paciente.
    try {
      const { autoUpsertNeuroIdDraft } = await import("@/services/neuro-id-service");
      await autoUpsertNeuroIdDraft(inv.patient_id, inv.clinic_id, supabase);
    } catch (e) {
      console.error("Bio3 auto-draft (form submit) falhou:", e);
    }

    return NextResponse.json({ ok: true, response_id: response.id });
  } catch (err: unknown) {
    console.error("Form submit error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno" },
      { status: 500 }
    );
  }
}
