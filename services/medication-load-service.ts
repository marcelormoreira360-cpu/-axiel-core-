/**
 * medication-load-service.ts — Medicação (carga) no Mapa Bio³.
 *
 * Fluxo: lê a resposta de texto livre do QRM ("medicamentos e suplementos que toma"),
 * a IA separa REMÉDIOS de SUPLEMENTOS e conta os remédios; o terapeuta confirma (gate)
 * e a contagem fica salva em patients.assessment_data (chave reservada). O motor lê a
 * contagem confirmada via confirmedMedicationLoad e injeta o item `medicacao_carga`
 * (pilar Bioquímico). Suplementos NÃO pontuam. Sem migration.
 */
import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { medicationLoadValue, MEDICACAO_CARGA_CODE } from "@/lib/medication-load";

/** Chaves reservadas em patients.assessment_data (prefixo __ não colide com field_keys). */
const MED_COUNT_KEY = "__medicacao_count";
const MED_MEDS_KEY = "__medicacao_remedios";
const MED_SUPPS_KEY = "__medicacao_suplementos";

export type MedicationExtraction = {
  medications: string[];
  supplements: string[];
  medication_count: number;
};

export type MedicationSuggestion =
  | ({ sourceText: string } & MedicationExtraction)
  | { error: string };

// ── Lê a resposta de texto livre de medicação no QRM ─────────────────────────
async function getMedicationAnswerText(patientId: string, clinicId: string): Promise<string | null> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  const { data: resp } = await supabase
    .from("assessment_responses")
    .select("id, template_id, assessment_templates!inner(name)")
    .eq("patient_id", patientId)
    .eq("clinic_id", clinicId)
    .ilike("assessment_templates.name", "%Rastreamento Metab%")
    .order("filled_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!resp) return null;
  const r = resp as unknown as { id: string; template_id: string };

  const [{ data: answers }, { data: sections }] = await Promise.all([
    supabase
      .from("assessment_answers")
      .select("value_text, section_id, assessment_questions(text)")
      .eq("response_id", r.id)
      .not("value_text", "is", null),
    supabase.from("assessment_sections").select("id, title").eq("template_id", r.template_id),
  ]);

  const secTitle = new Map<string, string>();
  for (const s of sections ?? []) secTitle.set(s.id as string, ((s.title as string) ?? "").toLowerCase());

  const parts: string[] = [];
  for (const a of answers ?? []) {
    const q = Array.isArray(a.assessment_questions) ? a.assessment_questions[0] : a.assessment_questions;
    const qText = String((q?.text as string) ?? "").toLowerCase();
    const sTitle = secTitle.get(a.section_id as string) ?? "";
    const isMed = /medicament|suplement|medica[çc][aã]o/.test(sTitle) || /medicament|suplement|rem[ée]dio/.test(qText);
    const val = String(a.value_text ?? "").trim();
    if (isMed && val) parts.push(val);
  }
  const text = parts.join("\n").trim();
  return text || null;
}

// ── Extração por IA: separa remédios de suplementos e conta os remédios ───────
const MED_SYSTEM_PROMPT = `Você classifica uma lista de itens que um paciente disse tomar, separando MEDICAMENTOS (fármacos/remédios de prescrição ou de venda livre) de SUPLEMENTOS (vitaminas, minerais, fitoterápicos, probióticos, ômega-3, proteína, etc.).

REGRAS:
- Devolva SÓ JSON: {"medications": string[], "supplements": string[], "medication_count": number}.
- "medication_count" = quantidade de MEDICAMENTOS distintos (não conte suplementos).
- Na dúvida entre remédio e suplemento, classifique como suplemento (conservador: suplemento não pontua).
- Use os nomes como o paciente escreveu (limpe só espaços/numeração).
- Não invente itens nem doses. Não diagnostique. Se o texto estiver vazio ou sem itens, devolva listas vazias e count 0.`;

export async function extractMedicationLoad(text: string): Promise<MedicationExtraction> {
  const clean = (text ?? "").trim();
  if (!clean) return { medications: [], supplements: [], medication_count: 0 };
  if (!process.env.OPENAI_API_KEY) {
    // Sem IA: não inventa classificação; devolve tudo como "a confirmar" em suplementos (não pontua).
    return { medications: [], supplements: [], medication_count: 0 };
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: MED_SYSTEM_PROMPT },
      { role: "user", content: clean },
    ],
  });
  let parsed: Partial<MedicationExtraction> = {};
  try {
    parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  } catch {
    parsed = {};
  }
  const medications = Array.isArray(parsed.medications) ? parsed.medications.map(String).filter(Boolean) : [];
  const supplements = Array.isArray(parsed.supplements) ? parsed.supplements.map(String).filter(Boolean) : [];
  const medication_count = Number.isFinite(parsed.medication_count as number)
    ? Math.max(0, Math.floor(parsed.medication_count as number))
    : medications.length;
  return { medications, supplements, medication_count };
}

/** Junta leitura do QRM + extração por IA (para o terapeuta revisar). */
export async function suggestMedicationLoad(patientId: string, clinicId: string): Promise<MedicationSuggestion> {
  const text = await getMedicationAnswerText(patientId, clinicId);
  if (!text) return { error: "Sem resposta de medicação no QRM para extrair." };
  const extraction = await extractMedicationLoad(text);
  return { sourceText: text, ...extraction };
}

// ── Persistência da contagem CONFIRMADA (em assessment_data, sem migration) ───
export async function saveMedicationLoad(
  patientId: string,
  clinicId: string,
  input: { count: number; medications?: string[]; supplements?: string[] },
): Promise<void> {
  const { getPatientById, updatePatient } = await import("@/services/patient-service");
  const patient = await getPatientById(patientId, clinicId);
  if (!patient) throw new Error("Paciente não encontrado nesta clínica.");
  const count = Math.max(0, Math.floor(input.count));
  const assessment_data = {
    ...(patient.assessment_data ?? {}),
    [MED_COUNT_KEY]: count,
    [MED_MEDS_KEY]: (input.medications ?? []).join(", "),
    [MED_SUPPS_KEY]: (input.supplements ?? []).join(", "),
  };
  await updatePatient(patientId, { assessment_data });
}

/**
 * Valor confirmado do item `medicacao_carga` (0-10) para o motor, ou {} se nunca
 * confirmado. Lê a contagem salva em assessment_data. Aceita um client (o gatilho
 * automático passa o admin client, que enxerga o paciente sem sessão). Resiliente a erro.
 */
export async function confirmedMedicationLoad(
  patientId: string,
  clinicId: string,
  client?: SupabaseClient,
): Promise<Record<string, number>> {
  try {
    const supabase = client ?? (await (await import("@/lib/supabase-server")).createSupabaseServerClient());
    const { data } = await supabase
      .from("patients")
      .select("assessment_data")
      .eq("id", patientId)
      .eq("clinic_id", clinicId)
      .maybeSingle();
    const raw = (data?.assessment_data as Record<string, unknown> | null | undefined)?.[MED_COUNT_KEY];
    if (raw === undefined || raw === null) return {};
    const count = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(count)) return {};
    return { [MEDICACAO_CARGA_CODE]: medicationLoadValue(count) };
  } catch {
    return {};
  }
}
