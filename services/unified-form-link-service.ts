import crypto from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { checkRateLimitDb } from "@/lib/webhook-guard";
import { createLogger } from "@/lib/logger";
import { UNIFIED_FORM } from "@/modules/neuro-id/unified-form-template";
import { saveUnifiedFormResult } from "@/services/unified-form-bio3-service";
import { bio3FromAnswerRows, type AnswerRow } from "@/modules/neuro-id/unified-form-result";
import type { SafetyFlags } from "@/lib/safety-flags";

const log = createLogger("unified-form-link");

/** Nome canônico do template placeholder do formulário unificado (fonte: código). */
export const UNIFIED_TEMPLATE_NAME = UNIFIED_FORM.name;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Garante (idempotente) um template PLACEHOLDER do formulário unificado na
 * clínica, só para servir de âncora ao convite (`assessment_invitations.template_id`
 * é NOT NULL). O formulário em si é renderizado a partir do CÓDIGO
 * (`unified-form-template.ts`) e a pontuação usa o mapeamento code→Bio³ em código
 * — o banco não guarda as perguntas. Entra INATIVO e sem placement (fora do envio
 * automático e da lista de intake). Não depende da migration 148.
 */
export async function ensureUnifiedTemplate(clinicId: string): Promise<string> {
  const supabase = createSupabaseAdminClient();

  const { data: existing } = await supabase
    .from("assessment_templates")
    .select("id, is_active")
    .eq("clinic_id", clinicId)
    .eq("name", UNIFIED_TEMPLATE_NAME)
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    // ATIVO para aparecer na seção Formulários (enviado como os outros). O envio
    // desvia para a rota rica /neuro-id/[token] (ver invite actions). placement
    // vazio: não entra no auto-envio do 1º agendamento.
    if (existing.is_active !== true) {
      await supabase.from("assessment_templates").update({ is_active: true }).eq("id", existing.id);
    }
    return existing.id as string;
  }

  const { data: created, error } = await supabase
    .from("assessment_templates")
    .insert({
      clinic_id: clinicId,
      name: UNIFIED_TEMPLATE_NAME,
      description: "Formulário unificado do método Neuro ID — Perfil Clínico Integrado de 30 Dias.",
      instructions: `${UNIFIED_FORM.recall}\n\n${UNIFIED_FORM.disclaimer}`,
      is_active: true,
      placement: [],
      send_on_first_appointment: false,
    })
    .select("id")
    .single();
  if (error) throw error;
  log.info("template do formulário unificado criado", { clinic_id: clinicId, template_id: created.id });
  return created.id as string;
}

/** É o template do formulário unificado Neuro ID? (o envio dele desvia para a rota rica). */
export async function isUnifiedTemplate(templateId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("assessment_templates")
    .select("name")
    .eq("id", templateId)
    .maybeSingle();
  return data?.name === UNIFIED_TEMPLATE_NAME;
}

/** Resolução do token do link do formulário unificado (rota pública dedicada). */
export type UnifiedLinkLookup =
  | { status: "ok"; clinicId: string; patientId: string | null; kind: "patient" | "public"; patientName: string | null; locale: string | null; tokenHash: string }
  | { status: "completed" }
  | { status: "expired" }
  | { status: "invalid" };

/**
 * Resolve o token do link do formulário unificado. Confirma que o convite aponta
 * para o template unificado (por nome) — senão é um link de outro formulário e
 * esta rota não o atende. Convite de paciente é de uso único; link público é
 * reutilizável.
 */
export async function getUnifiedLinkByToken(token: string): Promise<UnifiedLinkLookup> {
  const supabase = createSupabaseAdminClient();
  const token_hash = hashToken(token);

  const { data: inv } = await supabase
    .from("assessment_invitations")
    .select("id, clinic_id, patient_id, template_id, kind, completed_at, expires_at")
    .eq("token_hash", token_hash)
    .maybeSingle();

  if (!inv) return { status: "invalid" };

  // Confirma que é o formulário unificado.
  const { data: tpl } = await supabase
    .from("assessment_templates")
    .select("name")
    .eq("id", inv.template_id)
    .maybeSingle();
  if (!tpl || tpl.name !== UNIFIED_TEMPLATE_NAME) return { status: "invalid" };

  const isPublic = inv.kind === "public";
  if (!isPublic && inv.completed_at) return { status: "completed" };
  if (new Date(inv.expires_at) < new Date()) return { status: "expired" };

  let patientName: string | null = null;
  let locale: string | null = null;
  if (inv.patient_id) {
    const { data: p } = await supabase
      .from("patients")
      .select("full_name, locale")
      .eq("id", inv.patient_id)
      .maybeSingle();
    patientName = p?.full_name ?? "Paciente";
    locale = (p?.locale as string | null) ?? null;
  }

  return {
    status: "ok",
    clinicId: inv.clinic_id as string,
    patientId: (inv.patient_id as string | null) ?? null,
    kind: isPublic ? "public" : "patient",
    patientName,
    locale,
    tokenHash: token_hash,
  };
}

/** Converte o AnswerMap do componente (code → valor) em linhas numéricas do motor. */
function answerRows(answers: Record<string, number | string | string[]>): AnswerRow[] {
  return Object.entries(answers)
    .filter(([, v]) => typeof v === "number")
    .map(([code, v]) => ({ code, value: v as number }));
}

export type UnifiedPublicContact = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  consent?: boolean;
  /** honeypot: deve chegar vazio */
  website?: string | null;
};

export type UnifiedSubmitResult =
  | { ok: true; kind: "patient"; assessmentId: string; safety: SafetyFlags }
  | { ok: true; kind: "public"; leadId: string; safety: SafetyFlags }
  | { ok: false; error: string };

/**
 * Submete as respostas do formulário unificado vindas de um LINK (sem sessão de
 * usuário). Valida o token, aplica rate-limit e roteia:
 *  - convite de PACIENTE → grava o Bio³ do paciente (mesmo motor do fluxo interno)
 *    e marca o convite como respondido;
 *  - link PÚBLICO → cria/atualiza um Lead com o Índice Bio nas notas (sem paciente,
 *    logo sem pirâmide até a conversão) e guarda a submissão.
 */
export async function submitUnifiedFormViaToken(
  token: string,
  answers: Record<string, number | string | string[]>,
  ctx: { ip: string | null; userAgent: string | null; contact?: UnifiedPublicContact },
): Promise<UnifiedSubmitResult> {
  const lookup = await getUnifiedLinkByToken(token);
  if (lookup.status === "invalid") return { ok: false, error: "Link inválido." };
  if (lookup.status === "expired") return { ok: false, error: "Link expirado." };
  if (lookup.status === "completed") return { ok: false, error: "Este questionário já foi respondido." };

  const rows = answerRows(answers);
  if (rows.length === 0) return { ok: false, error: "Responda ao menos uma pergunta antes de enviar." };

  const supabase = createSupabaseAdminClient();

  // ── Convite de PACIENTE: grava o Bio³ direto no paciente ──────────────────────
  if (lookup.kind === "patient" && lookup.patientId) {
    if (!(await checkRateLimitDb(`unified-form:${lookup.tokenHash}`, 5, 15 * 60_000))) {
      return { ok: false, error: "Muitas tentativas. Tente novamente em alguns minutos." };
    }
    const res = await saveUnifiedFormResult(lookup.patientId, lookup.clinicId, rows);
    await supabase
      .from("assessment_invitations")
      .update({ completed_at: new Date().toISOString() })
      .eq("token_hash", lookup.tokenHash);
    log.info("Bio³ gravado via link de paciente", { clinic_id: lookup.clinicId, patient_id: lookup.patientId });
    return { ok: true, kind: "patient", assessmentId: res.assessmentId, safety: res.safety };
  }

  // ── Link PÚBLICO: vira Lead (sem paciente) ────────────────────────────────────
  const contact = ctx.contact;
  // honeypot: se preenchido, finge sucesso e ignora (bot).
  if (contact?.website) return { ok: true, kind: "public", leadId: "", safety: { crisis: false, cardioresp: false } };
  if (!contact || !contact.consent) return { ok: false, error: "Consentimento obrigatório." };

  const fullName = contact.full_name?.trim() || "";
  const email = contact.email?.trim().toLowerCase() || "";
  const phone = contact.phone ? (contact.phone.replace(/\D/g, "") || contact.phone.trim()) : null;
  const dob = contact.date_of_birth?.trim() || null;
  if (!fullName || !email) return { ok: false, error: "Nome e e-mail são obrigatórios." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "E-mail inválido." };
  if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return { ok: false, error: "Data de nascimento inválida." };

  const ip = ctx.ip;
  if (!(await checkRateLimitDb(`unified-public:${ip ?? "unknown"}`, 15, 60 * 60_000))) {
    return { ok: false, error: "Muitas tentativas. Tente novamente mais tarde." };
  }
  if (!(await checkRateLimitDb(`unified-public-daily:${lookup.tokenHash}`, 200, 24 * 60 * 60_000))) {
    return { ok: false, error: "Este link atingiu o limite diário de envios. Tente novamente amanhã." };
  }

  // Índice Bio calculado em memória (não vira pirâmide sem paciente) — entra na
  // nota do lead para triagem. Motor `scoring.ts` intocado.
  const outcome = bio3FromAnswerRows(rows);
  const indice = outcome.neuro.indiceGeral;
  const crisis = outcome.safety.crisis;
  const noteSummary =
    (crisis ? "⚠️ Sinal de encaminhamento de apoio registrado (revisão humana).\n" : "") +
    `Origem: link público — "${UNIFIED_TEMPLATE_NAME}".\n` +
    `Índice Bio (grau de disfunção): ${indice}/100. Prioridade: ${outcome.neuro.priorityPillar}.`;

  // Template placeholder (para invitation/submissão) + convite.
  const templateId = await ensureUnifiedTemplate(lookup.clinicId);
  const { data: inv } = await supabase
    .from("assessment_invitations")
    .select("id")
    .eq("token_hash", lookup.tokenHash)
    .maybeSingle();

  // Dedup de lead por e-mail dentro da clínica.
  let leadId: string | null = null;
  {
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id")
      .eq("clinic_id", lookup.clinicId)
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    leadId = existingLead?.id ?? null;
  }
  if (leadId) {
    await supabase
      .from("leads")
      .update({ full_name: fullName, phone: phone ?? undefined, date_of_birth: dob, notes: noteSummary, updated_at: new Date().toISOString() })
      .eq("id", leadId);
  } else {
    const { data: lead, error: lErr } = await supabase
      .from("leads")
      .insert({ clinic_id: lookup.clinicId, full_name: fullName, email, phone, date_of_birth: dob, source: "public_form", stage: "new_lead", notes: noteSummary })
      .select("id")
      .single();
    if (lErr) return { ok: false, error: "Não foi possível registrar agora. Tente novamente." };
    leadId = lead.id as string;
  }

  // Guarda a submissão completa (respostas por código + índice).
  try {
    await supabase.from("public_form_submissions").insert({
      clinic_id: lookup.clinicId,
      template_id: templateId,
      invitation_id: inv?.id ?? null,
      lead_id: leadId,
      full_name: fullName,
      email,
      phone,
      date_of_birth: dob,
      consent_ip: ip && ip !== "unknown" ? ip : null,
      consent_user_agent: ctx.userAgent?.slice(0, 300) ?? null,
      answers,
      total_score: indice,
      max_possible_score: 100,
      score_percentage: indice,
    });
  } catch (e) {
    // A submissão detalhada é best-effort — o lead já foi criado.
    log.warn("public_form_submissions (unified) falhou", { err: e instanceof Error ? e.message : String(e) });
  }

  return { ok: true, kind: "public", leadId: leadId ?? "", safety: outcome.safety };
}
