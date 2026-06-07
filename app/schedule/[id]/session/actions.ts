"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { upsertSessionRecord } from "@/services/session-recording-service";
import { generateAndSaveAiInsight } from "@/services/ai-insight-service";
import { syncZoomRecordingsForMeeting } from "@/services/zoom-service";
import type { AiInsight, ClinicalTestResult } from "@/lib/types";

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

  // Vitals — integer 1–5 or null
  function parseVital(key: string): number | null {
    const raw = formData.get(key);
    if (raw === null || raw === "") return null;
    const n = parseInt(String(raw), 10);
    return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
  }
  const vitals = {
    dor:    parseVital("vitals_dor"),
    energia: parseVital("vitals_energia"),
    humor:  parseVital("vitals_humor"),
    sono:   parseVital("vitals_sono"),
  };
  const hasVitals = Object.values(vitals).some((v) => v !== null);

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
    });
  } catch (err: unknown) {
    console.error("[saveSessionRecord] upsert failed:", err);
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
 * Suggests SOAP field content based on the patient's recent session history
 * and any draft notes already typed. Runs BEFORE the session is saved.
 */
export async function suggestSoapAction(
  patientId: string,
  draftNotes: string,
): Promise<{ suggestion: SoapSuggestion | null; error: string | null }> {
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
    const supabase = createSupabaseAdminClient();

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
      return `Sessão anterior ${i + 1} (${new Date(r.created_at).toLocaleDateString("pt-BR")}):\n${parts.join("\n")}`;
    }).join("\n\n");

    const systemPrompt = `Você é um assistente clínico para profissionais de saúde integrativa.
Sua tarefa é sugerir o preenchimento de uma nota SOAP para a sessão atual com base no histórico do paciente.
Responda APENAS com um objeto JSON válido no formato:
{"subjective":"...","objective":"...","assessment_note":"...","plan":"..."}
Seja conciso e clínico. Use português brasileiro. Não invente dados — baseie-se no histórico.
Se não houver histórico suficiente, sugira um template padrão para o tipo de sessão.`;

    const userPrompt = history
      ? `Histórico recente do paciente:\n${history}\n\n${draftNotes ? `Notas em rascunho do profissional:\n${draftNotes}\n\n` : ""}Sugira o preenchimento SOAP para a sessão atual.`
      : `${draftNotes ? `Notas em rascunho:\n${draftNotes}\n\n` : ""}Não há histórico anterior. Sugira um template SOAP inicial para uma sessão integrativa.`;

    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 600,
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
    console.error("[suggestSoapAction] failed:", err);
    return { suggestion: null, error: "Erro ao gerar sugestão SOAP." };
  }
}
