import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getBillingContext } from "@/services/billing-service";
import { canUseFeature } from "@/modules/billing/feature-access";
import { checkRateLimitDb } from "@/lib/webhook-guard";

// ─── Supabase result types ────────────────────────────────────────────────────

interface ExamResult {
  biomarker: string;
  value: string | number;
  unit: string | null;
  ref_min: string | number | null;
  ref_max: string | number | null;
  status: string;
}

interface PatientExam {
  exam_date: string;
  lab_name: string | null;
  exam_results: ExamResult[];
}

interface Prescription {
  name: string;
  dosage: string | null;
  frequency: string | null;
  type: string;
}

interface SessionRecord {
  notes: string | null;
  key_observations: string[] | null;
  created_at: string;
}

interface SectionScore {
  title: string;
  score: number;
  max: number;
}

interface AssessmentResponse {
  total_score: number | null;
  max_possible_score: number | null;
  score_percentage: number | null;
  section_scores: Record<string, SectionScore> | null;
  notes: string | null;
  // Supabase returns joined rows as an array from select("assessment_templates(name)")
  assessment_templates: { name: string }[] | { name: string } | null;
}

interface IntakeResponse {
  answers: Record<string, unknown>;
  created_at: string;
}

// ─── Context builder ──────────────────────────────────────────────────────────

/**
 * Builds the clinical context for the AI.
 * Returns null if the patient doesn't belong to the caller's clinic —
 * the route handler converts this to a 403.
 */
async function buildPatientContext(
  patientId: string,
  clinicId: string,
) {
  const supabase = await createSupabaseServerClient();

  // Verify ownership first: the patient must belong to the caller's clinic.
  const { data: patient } = await supabase
    .from("patients")
    .select("full_name, date_of_birth, notes, clinic_id")
    .eq("id", patientId)
    .eq("clinic_id", clinicId) // ← ownership check
    .maybeSingle();

  if (!patient) return null; // patient not found or belongs to a different clinic

  const [
    { data: exams },
    { data: prescriptions },
    { data: sessions },
    { data: assessments },
    { data: intakeResponses },
  ] = await Promise.all([
    supabase
      .from("patient_exams")
      .select("exam_date, lab_name, exam_results(biomarker, value, unit, ref_min, ref_max, status)")
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .order("exam_date", { ascending: false })
      .limit(5),
    supabase
      .from("patient_prescriptions")
      .select("name, dosage, frequency, type")
      .eq("patient_id", patientId)
      .eq("is_active", true),
    supabase
      .from("session_records")
      .select("notes, key_observations, created_at")
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("assessment_responses")
      .select(
        "total_score, max_possible_score, score_percentage, section_scores, notes, assessment_templates(name)"
      )
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .order("filled_at", { ascending: false })
      .limit(3),
    supabase
      .from("intake_responses")
      .select("answers, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const age = patient?.date_of_birth
    ? Math.floor(
        (Date.now() - new Date(patient.date_of_birth).getTime()) /
          (1000 * 60 * 60 * 24 * 365)
      )
    : null;

  // Format exams
  const examsText = ((exams ?? []) as PatientExam[])
    .map((e) => {
      const results = (e.exam_results ?? [])
        .map(
          (r) =>
            `  - ${r.biomarker}: ${r.value} ${r.unit ?? ""} [ref: ${r.ref_min ?? "?"}–${r.ref_max ?? "?"}] → ${r.status.toUpperCase()}`
        )
        .join("\n");
      return `Exame ${e.exam_date} (${e.lab_name ?? "Lab"}):\n${results || "  Sem biomarcadores"}`;
    })
    .join("\n\n");

  // Format prescriptions
  const typedPrescriptions = (prescriptions ?? []) as Prescription[];
  const meds = typedPrescriptions
    .filter((p) => p.type === "medication")
    .map((p) => `  - ${p.name} ${p.dosage ?? ""} ${p.frequency ?? ""}`)
    .join("\n");
  const supps = typedPrescriptions
    .filter((p) => p.type === "supplement")
    .map((p) => `  - ${p.name} ${p.dosage ?? ""} ${p.frequency ?? ""}`)
    .join("\n");

  // Format sessions
  const sessionsText = ((sessions ?? []) as SessionRecord[])
    .map((s) => {
      const obs = (s.key_observations ?? []).join(", ");
      return `[${new Date(s.created_at).toLocaleDateString("pt-BR")}] ${s.notes ?? ""} ${obs ? `| Obs: ${obs}` : ""}`;
    })
    .join("\n");

  // Format assessments
  const assessmentsText = ((assessments ?? []) as AssessmentResponse[])
    .map((a) => {
      const sections = Object.entries(a.section_scores ?? {})
        .map(([, v]) => `    ${v.title}: ${v.score}/${v.max}`)
        .join("\n");
      const templateName = Array.isArray(a.assessment_templates)
        ? (a.assessment_templates[0] as { name: string } | undefined)?.name
        : a.assessment_templates?.name;
      return `${templateName ?? "Formulário"} — Total: ${a.total_score}/${a.max_possible_score} (${a.score_percentage?.toFixed(1)}%)\n${sections}`;
    })
    .join("\n\n");

  // Format intake
  const firstIntake = ((intakeResponses ?? []) as IntakeResponse[])[0];
  const intakeText = firstIntake
    ? Object.entries(firstIntake.answers ?? {})
        .map(([q, a]) => `  ${q}: ${String(a)}`)
        .join("\n")
    : "Não disponível";

  return {
    name: patient?.full_name ?? "Paciente",
    age,
    clinicalNotes: patient?.notes ?? "",
    examsText: examsText || "Sem exames registrados",
    medsText: meds || "Nenhum",
    suppsText: supps || "Nenhum",
    sessionsText: sessionsText || "Sem sessões registradas",
    assessmentsText: assessmentsText || "Sem formulários respondidos",
    intakeText,
  };
}

// ─── Response types ───────────────────────────────────────────────────────────

interface PriorityFinding {
  finding: string;
  severity: "alta" | "media" | "baixa";
  detail: string;
}

interface ExamAnalysis {
  biomarker: string;
  status: "alto" | "baixo" | "normal";
  clinical_significance: string;
  trend: string;
}

interface InteractionAlert {
  item_a: string;
  item_b: string;
  interaction: string;
  severity: "alta" | "media" | "baixa";
  recommendation: string;
}

interface ProtocolSuggestion {
  area: string;
  suggestion: string;
  rationale: string;
}

interface AttentionArea {
  area: string;
  explanation: string;
  action: string;
}

export interface HealthAgentReport {
  practitioner: {
    clinical_summary: string;
    priority_findings: PriorityFinding[];
    exam_analysis: ExamAnalysis[];
    interaction_alerts: InteractionAlert[];
    protocol_suggestions: ProtocolSuggestion[];
    monitoring_points: string[];
    next_session_focus: string;
  };
  patient: {
    greeting: string;
    overall_message: string;
    positive_points: string[];
    attention_areas: AttentionArea[];
    next_steps: string[];
    encouragement: string;
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth + clinic resolution ────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("clinic_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.clinic_id) {
    return NextResponse.json({ error: "Usuário sem clínica associada." }, { status: 403 });
  }

  // ── Rate limiting: 10 GPT-4 calls per clinic per hour ──────────────────────
  if (!(await checkRateLimitDb(`health-agent:${profile.clinic_id}`, 10, 60 * 60_000))) {
    return NextResponse.json(
      { error: "Limite de análises atingido. Tente novamente em alguns minutos." },
      { status: 429 }
    );
  }

  // ── Feature gate: ai_insights ───────────────────────────────────────────────
  const billingCtx = await getBillingContext(profile.clinic_id);
  if (!canUseFeature(billingCtx, "ai_insights")) {
    return NextResponse.json(
      { error: "Insights com IA disponíveis no plano Professional ou superior." },
      { status: 403 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY não configurada" },
      { status: 500 }
    );
  }

  try {
    const { patientId } = (await req.json()) as { patientId?: string };
    if (!patientId)
      return NextResponse.json(
        { error: "patient_id obrigatório" },
        { status: 400 }
      );

    // buildPatientContext verifies patient.clinic_id === profile.clinic_id
    // and returns null if the patient doesn't belong to this clinic.
    const ctx = await buildPatientContext(patientId, profile.clinic_id);
    if (!ctx) {
      return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });
    }

    const systemPrompt = `Você é um agente clínico especialista em medicina integrativa e funcional.
Sua função é analisar dados clínicos de pacientes e gerar dois relatórios distintos:
1. Um relatório TÉCNICO para o profissional de saúde
2. Um relatório SIMPLES e encorajador para o paciente

Seja preciso, baseado em evidências, e sempre ressalte que as análises não substituem avaliação médica.
Identifique padrões, correlações e possíveis interações entre medicamentos e suplementos.
Responda SEMPRE em JSON válido.`;

    const userPrompt = `Analise os dados clínicos de ${ctx.name}${ctx.age ? `, ${ctx.age} anos` : ""}:

## EXAMES LABORATORIAIS
${ctx.examsText}

## MEDICAMENTOS EM USO
${ctx.medsText}

## SUPLEMENTOS EM USO
${ctx.suppsText}

## NOTAS DAS SESSÕES (últimas 6)
${ctx.sessionsText}

## FORMULÁRIOS RESPONDIDOS
${ctx.assessmentsText}

## ANAMNESE INICIAL
${ctx.intakeText}

---

Gere um JSON com EXATAMENTE esta estrutura:
{
  "practitioner": {
    "clinical_summary": "resumo clínico técnico em 3-5 frases",
    "priority_findings": [
      { "finding": "achado clínico", "severity": "alta|media|baixa", "detail": "explicação técnica" }
    ],
    "exam_analysis": [
      { "biomarker": "nome", "status": "alto|baixo|normal", "clinical_significance": "interpretação clínica", "trend": "observação" }
    ],
    "interaction_alerts": [
      { "item_a": "medicamento ou suplemento", "item_b": "medicamento ou suplemento", "interaction": "descrição da interação", "severity": "alta|media|baixa", "recommendation": "conduta sugerida" }
    ],
    "protocol_suggestions": [
      { "area": "área de intervenção", "suggestion": "sugestão de protocolo", "rationale": "justificativa clínica" }
    ],
    "monitoring_points": ["ponto de monitoramento 1", "ponto 2"],
    "next_session_focus": "foco sugerido para próxima sessão"
  },
  "patient": {
    "greeting": "mensagem personalizada de abertura (use o primeiro nome, tom acolhedor)",
    "overall_message": "mensagem geral sobre o momento clínico em linguagem simples (2-3 frases)",
    "positive_points": ["ponto positivo 1", "ponto positivo 2"],
    "attention_areas": [
      { "area": "área de atenção", "explanation": "explicação simples sem termos técnicos", "action": "o que o paciente pode fazer" }
    ],
    "next_steps": ["próximo passo 1", "próximo passo 2", "próximo passo 3"],
    "encouragement": "mensagem final de encorajamento personalizada"
  }
}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      throw new Error(err?.error?.message ?? `OpenAI error ${res.status}`);
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const report = JSON.parse(data.choices[0].message.content) as HealthAgentReport;
    return NextResponse.json({ report, patientName: ctx.name });
  } catch (err: unknown) {
    console.error("Health agent error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno" },
      { status: 500 }
    );
  }
}
