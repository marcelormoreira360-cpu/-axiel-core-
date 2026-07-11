"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { reportModel } from "@/lib/ai-models";
import { upsertSessionRecord } from "@/services/session-recording-service";
import { generateAndSaveAiInsight, suggestScribeAtm } from "@/services/ai-insight-service";
import { syncZoomRecordingsForMeeting, transcribeZoomRecording } from "@/services/zoom-service";
import { getCurrentClinic } from "@/services/clinic-service";
import { getPatientById, updatePatient } from "@/services/patient-service";
import { resolveLocale } from "@/i18n/get-locale";
import type { AiInsight, ClinicalTestResult, BodyMapNote } from "@/lib/types";
import { createLogger } from "@/lib/logger";
import { languageInstruction } from "@/lib/ai-language";

const log = createLogger("session-actions");

export type SaveSessionState = { error?: string } | null;

export async function saveSessionRecord(
  _prev: SaveSessionState,
  formData: FormData,
): Promise<SaveSessionState> {
  const appointmentId = String(formData.get("appointment_id") ?? "");
  const patientId     = String(formData.get("patient_id") ?? "");
  const clinicId      = String(formData.get("clinic_id") ?? "");
  const notes         = String(formData.get("notes") ?? "").trim();
  const observationsRaw = String(formData.get("key_observations") ?? "[]");
  const soapMode      = formData.get("soap_mode") === "1";
  const subjective    = String(formData.get("subjective") ?? "").trim() || null;
  const objective     = String(formData.get("objective") ?? "").trim() || null;
  const assessmentNote = String(formData.get("assessment_note") ?? "").trim() || null;
  const plan          = String(formData.get("plan") ?? "").trim() || null;

  // Vitais — chaves dinâmicas (config por clínica): lê todo vitals_<key>, inteiro
  // 1–10 (a escala é definida por clínica; 10 é o teto possível).
  const vitals: Record<string, number> = {};
  for (const [k, raw] of formData.entries()) {
    if (!k.startsWith("vitals_")) continue;
    if (raw === null || raw === "") continue;
    const n = parseInt(String(raw), 10);
    if (Number.isFinite(n) && n >= 1 && n <= 10) vitals[k.slice("vitals_".length)] = n;
  }
  const hasVitals = Object.keys(vitals).length > 0;

  let keyObservations: string[] = [];
  try {
    const parsed = JSON.parse(observationsRaw);
    if (Array.isArray(parsed)) {
      keyObservations = parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    keyObservations = [];
  }

  // Testes clínicos presenciais (Feature 3): só linhas com nome preenchido
  let clinicalTests: ClinicalTestResult[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("clinical_tests") ?? "[]"));
    if (Array.isArray(parsed)) {
      clinicalTests = parsed
        .filter((r): r is { name: unknown; result?: unknown; notes?: unknown } => !!r && typeof r === "object")
        .map((r) => ({
          name: String(r.name ?? "").trim(),
          result: String(r.result ?? "").trim(),
          notes: String(r.notes ?? "").trim() || undefined,
        }))
        .filter((r) => r.name);
    }
  } catch {
    clinicalTests = [];
  }

  // Anotações de mapa anatômico: só linhas com nota preenchida
  let bodyMapNotes: BodyMapNote[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("body_map_notes") ?? "[]"));
    if (Array.isArray(parsed)) {
      bodyMapNotes = parsed
        .filter((r): r is { map: unknown; notes?: unknown; markers?: unknown } => !!r && typeof r === "object")
        .map((r) => ({
          map: String(r.map ?? "").trim(),
          notes: String(r.notes ?? "").trim(),
          markers: Array.isArray(r.markers)
            ? r.markers
                .filter((m): m is { x: number; y: number; label?: unknown; intensity?: unknown } => !!m && typeof (m as { x: unknown }).x === "number" && typeof (m as { y: unknown }).y === "number")
                .map((m) => {
                  const intensity = m.intensity === 1 || m.intensity === 3 ? m.intensity : 2;
                  const label = typeof m.label === "string" ? m.label.trim() : "";
                  return { x: m.x, y: m.y, intensity: intensity as 1 | 2 | 3, ...(label ? { label } : {}) };
                })
            : [],
        }))
        .filter((r) => r.map && (r.notes || r.markers.length > 0));
    }
  } catch {
    bodyMapNotes = [];
  }

  if (!appointmentId || !patientId || !clinicId) {
    return { error: "Informações da sessão estão incompletas. Recarregue a página." };
  }

  try {
    await upsertSessionRecord({
      appointment_id:  appointmentId,
      patient_id:      patientId,
      clinic_id:       clinicId,
      notes,
      key_observations: keyObservations,
      soap_mode:       soapMode,
      subjective,
      objective,
      assessment_note: assessmentNote,
      plan,
      vitals:          hasVitals ? vitals : null,
      clinical_tests:  clinicalTests.length ? clinicalTests : null,
      body_map_notes:  bodyMapNotes.length ? bodyMapNotes : null,
    });
  } catch (err: unknown) {
    log.error("[saveSessionRecord] upsert failed", err);
    return { error: "Erro ao salvar a sessão. Tente novamente." };
  }

  revalidatePath(`/schedule/${appointmentId}/session`);
  revalidatePath(`/patients/${patientId}`);
  revalidatePath(`/patients/${patientId}/prontuario`);
  redirect(`/schedule/${appointmentId}/session?saved=1`);
}

export async function syncZoomRecordingsAction(
  appointmentId: string,
  zoomMeetingId: string,
  clinicId: string,
  patientId: string | null,
): Promise<{ synced: number; error: string | null }> {
  const result = await syncZoomRecordingsForMeeting(zoomMeetingId, appointmentId, clinicId, patientId);
  if (result.synced > 0) revalidatePath(`/schedule/${appointmentId}/session`);
  return result;
}

export async function generateSessionInsightAction(
  patientId: string,
): Promise<{ insight: AiInsight | null; error: string | null }> {
  try {
    const insight = await generateAndSaveAiInsight(patientId);
    revalidatePath(`/patients/${patientId}/insights`);
    return { insight, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar insight.";
    return { insight: null, error: msg };
  }
}

// ── SOAP pre-fill suggestion ──────────────────────────────────────────────────

export type SoapSuggestion = {
  subjective: string;
  objective: string;
  assessment_note: string;
  plan: string;
};

/**
 * Escriba clínico: organiza a transcrição/notas da consulta atual (e o histórico
 * recente) numa nota SOAP. RASCUNHO para o terapeuta revisar. Roda ANTES de salvar.
 * `locale` = idioma da clínica/UI (a nota é material interno da equipe, não do paciente).
 */
export async function suggestSoapAction(
  patientId: string,
  draftNotes: string,
  locale?: string,
): Promise<{ suggestion: SoapSuggestion | null; error: string | null }> {
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
    const supabase = createSupabaseAdminClient();
    const dateLocale = locale ?? "pt-BR";

    // Fetch last 5 session records for this patient
    const { data: records } = await supabase
      .from("session_records")
      .select("subjective, objective, assessment_note, plan, notes, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(5);

    const history = (records ?? []).map((r, i) => {
      const parts: string[] = [];
      if (r.subjective)      parts.push(`S: ${r.subjective}`);
      if (r.objective)       parts.push(`O: ${r.objective}`);
      if (r.assessment_note) parts.push(`A: ${r.assessment_note}`);
      if (r.plan)            parts.push(`P: ${r.plan}`);
      if (r.notes && !parts.length) parts.push(r.notes);
      return `Sessão anterior ${i + 1} (${new Date(r.created_at).toLocaleDateString(dateLocale)}):\n${parts.join("\n")}`;
    }).join("\n\n");

    // Guarda-corpos clínicos (Salvo/Aval): rascunho, sem diagnóstico fechado/cura,
    // linguagem prudente, sem inventar dados, encaminha em red flags, sem travessão.
    const systemPrompt = `Você é um assistente clínico (escriba) para profissionais de saúde integrativa.
Sua tarefa é ORGANIZAR o que foi dito/registrado na consulta atual (transcrição/notas) e o histórico recente numa nota SOAP.
${languageInstruction(locale)}
Regras (guarda-corpos clínicos, inegociáveis):
- É um RASCUNHO para o terapeuta revisar e editar. NÃO feche diagnóstico nem prometa cura.
- Use linguagem prudente: "sugere", "pode estar associado", "compatível com", "merece investigação" — nunca afirmações absolutas.
- Baseie-se APENAS no que foi dito/registrado e no histórico. NÃO invente sintomas, exames, medidas ou dados.
- Em sinais de alerta (dor torácica, falta de ar severa, ideação suicida, alteração neurológica aguda), registre a recomendação de encaminhamento adequado.
- Não julgue a evidência científica do método (não escreva "evidência limitada", "exploratório", etc.).
- Não use travessão (—); use vírgula, dois-pontos ou parênteses.
Responda APENAS com um objeto JSON válido no formato:
{"subjective":"...","objective":"...","assessment_note":"...","plan":"..."}
Se faltar informação para um campo, deixe-o vazio (""). Seja conciso e clínico.`;

    const userPrompt = history
      ? `Histórico recente do paciente:\n${history}\n\n${draftNotes ? `Transcrição/notas da consulta ATUAL:\n${draftNotes}\n\n` : ""}Organize a nota SOAP da sessão atual.`
      : `${draftNotes ? `Transcrição/notas da consulta ATUAL:\n${draftNotes}\n\n` : ""}Não há histórico anterior. Organize a nota SOAP a partir do que foi registrado (ou um template inicial se vazio).`;

    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      // SOAP clínico a partir da transcrição (escriba): tier REPORT (4.1-mini).
      model: reportModel(),
      temperature: 0.3,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        { role: "system",  content: systemPrompt },
        { role: "user",    content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<SoapSuggestion>;

    return {
      suggestion: {
        subjective:      parsed.subjective      ?? "",
        objective:       parsed.objective       ?? "",
        assessment_note: parsed.assessment_note ?? "",
        plan:            parsed.plan            ?? "",
      },
      error: null,
    };
  } catch (err: unknown) {
    log.error("[suggestSoapAction] failed", err);
    return { suggestion: null, error: "Erro ao gerar sugestão SOAP." };
  }
}

// ── Escriba Fase 2: transcrição → rascunho Neuro ID (ATM) ─────────────────────

// Mesmo marcador do painel de Avaliação (patient-assessment-panel.tsx): o texto
// ANTES do marcador é humano e é preservado; do marcador em diante é o rascunho.
const ATM_AI_MARKER = "[Sugestão IA (revise)]";

/**
 * Escriba (Fase 2): a partir da TRANSCRIÇÃO da consulta, gera um rascunho de
 * "Integração clínica (ATM)" (espinha ATM + eixos Bio³) e grava no campo
 * `integracao_atm` da Avaliação com o marcador [Sugestão IA (revise)] — preserva o
 * texto do terapeuta. O terapeuta revisa depois na ficha (painel Avaliação).
 * Escopo de clínica garantido por getCurrentClinic + getPatientById(clinic.id).
 */
export async function draftNeuroIdFromTranscriptAction(
  patientId: string,
  transcript: string,
): Promise<{ ok?: boolean; error?: string }> {
  const clinic = await getCurrentClinic();
  if (!clinic?.id) return { error: "Não autorizado." };
  const patient = await getPatientById(patientId, clinic.id);
  if (!patient) return { error: "Paciente não encontrado nesta clínica." };

  // Rascunho INTERNO (terapeuta lê): idioma da clínica (locale da UI).
  const res = await suggestScribeAtm(patientId, transcript, await resolveLocale());
  if ("error" in res) return { error: res.error };

  // Funde no integracao_atm preservando o texto humano antes do marcador.
  const current = (patient.assessment_data ?? {}) as Record<string, string | number | null>;
  const prevAtm = String(current.integracao_atm ?? "");
  const idx = prevAtm.indexOf(ATM_AI_MARKER);
  const base = (idx >= 0 ? prevAtm.slice(0, idx) : prevAtm).trim();
  const block = `${ATM_AI_MARKER}\n${res.suggestion.trim()}`;
  const merged = base ? `${base}\n\n${block}` : block;

  try {
    await updatePatient(patientId, {
      assessment_data: { ...current, integracao_atm: merged },
    });
    revalidatePath(`/patients/${patientId}`);
    return { ok: true };
  } catch (err: unknown) {
    log.error("[draftNeuroIdFromTranscriptAction] save failed", err);
    return { error: "Não foi possível salvar o rascunho de ATM." };
  }
}

// ── Escriba Fase 3: trazer a transcrição da gravação do Zoom (telesaúde) ──────

/**
 * Transcreve a gravação do Zoom da consulta (prefere o transcript do Zoom; cai
 * para o áudio via Whisper). Devolve o texto para o painel encadear SOAP + ATM,
 * como no escriba presencial. Escopo por clínica.
 */
export async function transcribeZoomRecordingAction(
  appointmentId: string,
): Promise<{ transcript?: string; error?: string }> {
  const clinic = await getCurrentClinic();
  if (!clinic?.id) return { error: "Não autorizado." };
  const res = await transcribeZoomRecording(appointmentId, clinic.id, await resolveLocale());
  if ("error" in res) return { error: res.error };
  return { transcript: res.transcript };
}

// ── Compliance: consentimento de gravação/escriba (PHI) ──────────────────────

/**
 * Registra o consentimento do paciente para gravação/transcrição por IA da
 * consulta (trilha de auditoria: quando + por quem). Gate do escriba: só depois
 * disso a gravação (presencial/Zoom) é liberada. O ÁUDIO não é armazenado.
 */
export async function confirmRecordingConsentAction(
  patientId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const clinic = await getCurrentClinic();
  if (!clinic?.id) return { error: "Não autorizado." };
  const patient = await getPatientById(patientId, clinic.id);
  if (!patient) return { error: "Paciente não encontrado nesta clínica." };
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase-server");
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    await updatePatient(patientId, {
      recording_consent_at: new Date().toISOString(),
      recording_consent_by: user?.id ?? null,
    });
    return { ok: true };
  } catch (err: unknown) {
    log.error("[confirmRecordingConsentAction] failed", err);
    return { error: "Não foi possível registrar o consentimento." };
  }
}
