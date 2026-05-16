import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

async function buildPatientContext(patientId: string) {
  const supabase = await createSupabaseServerClient();

  const [
    { data: patient },
    { data: exams },
    { data: prescriptions },
    { data: sessions },
    { data: assessments },
    { data: intakeResponses },
  ] = await Promise.all([
    supabase.from("patients").select("full_name, date_of_birth, notes").eq("id", patientId).single(),
    supabase.from("patient_exams").select("*, exam_results(*)").eq("patient_id", patientId).order("exam_date", { ascending: false }).limit(5),
    supabase.from("patient_prescriptions").select("*").eq("patient_id", patientId).eq("is_active", true),
    supabase.from("session_records").select("notes, key_observations, created_at").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(6),
    supabase.from("assessment_responses").select("*, assessment_templates(name), section_scores, total_score, max_possible_score, score_percentage, notes").eq("patient_id", patientId).order("filled_at", { ascending: false }).limit(3),
    supabase.from("intake_responses").select("answers, created_at").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(1),
  ]);

  const age = patient?.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365))
    : null;

  // Format exams
  const examsText = (exams ?? []).map((e: any) => {
    const results = (e.exam_results ?? []).map((r: any) =>
      `  - ${r.biomarker}: ${r.value} ${r.unit ?? ""} [ref: ${r.ref_min ?? "?"}–${r.ref_max ?? "?"}] → ${r.status.toUpperCase()}`
    ).join("\n");
    return `Exame ${e.exam_date} (${e.lab_name ?? "Lab"}):\n${results || "  Sem biomarcadores"}`;
  }).join("\n\n");

  // Format prescriptions
  const meds = (prescriptions ?? []).filter((p: any) => p.type === "medication")
    .map((p: any) => `  - ${p.name} ${p.dosage ?? ""} ${p.frequency ?? ""}`).join("\n");
  const supps = (prescriptions ?? []).filter((p: any) => p.type === "supplement")
    .map((p: any) => `  - ${p.name} ${p.dosage ?? ""} ${p.frequency ?? ""}`).join("\n");

  // Format sessions
  const sessionsText = (sessions ?? []).map((s: any) => {
    const obs = (s.key_observations ?? []).join(", ");
    return `[${new Date(s.created_at).toLocaleDateString("pt-BR")}] ${s.notes ?? ""} ${obs ? `| Obs: ${obs}` : ""}`;
  }).join("\n");

  // Format assessments
  const assessmentsText = (assessments ?? []).map((a: any) => {
    const sections = Object.entries(a.section_scores ?? {}).map(([, v]: any) =>
      `    ${v.title}: ${v.score}/${v.max}`
    ).join("\n");
    return `${(a as any).assessment_templates?.name ?? "Formulário"} — Total: ${a.total_score}/${a.max_possible_score} (${a.score_percentage?.toFixed(1)}%)\n${sections}`;
  }).join("\n\n");

  // Format intake
  const intakeText = intakeResponses?.[0]
    ? Object.entries((intakeResponses[0] as any).answers ?? {}).map(([q, a]) => `  ${q}: ${a}`).join("\n")
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

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY não configurada" }, { status: 500 });
  }

  try {
    const { patientId } = await req.json();
    if (!patientId) return NextResponse.json({ error: "patient_id obrigatório" }, { status: 400 });

    const ctx = await buildPatientContext(patientId);

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
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `OpenAI error ${res.status}`);
    }

    const data = await res.json();
    const report = JSON.parse(data.choices[0].message.content);
    return NextResponse.json({ report, patientName: ctx.name });
  } catch (err: unknown) {
    console.error("Health agent error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno" },
      { status: 500 }
    );
  }
}
