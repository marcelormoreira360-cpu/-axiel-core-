import { describe, it, expect } from "vitest";
import { buildCaseSummaryFallback } from "@/services/ai-insight/case-summary";
import type { AiInsightInputSnapshot } from "@/services/ai-insight/input-builder";

// Snapshot mínimo: só os campos que o fallback determinístico lê.
function snap(partial: {
  extra?: { label: string; value: string }[];
  anamnese?: string | null;
  neuro?: AiInsightInputSnapshot["neuro_id"];
  prescriptions?: AiInsightInputSnapshot["prescriptions"];
}): AiInsightInputSnapshot {
  return {
    patient: {
      id: "p1", clinic_id: "c1", full_name: "Teste", locale: null, status: "active",
      notes: null, age: null, sex: null, weight_kg: null, height_cm: null, city: null,
      anamnese: partial.anamnese ?? null, antecedents: null, pain_level: null,
      pain_location: null, treatment_note: null, assessment_extra: partial.extra ?? [],
    },
    intake: [], session_notes: [], patient_history: [], assessments: [],
    lab_exams: [], functional_exams: [], prescriptions: partial.prescriptions ?? [],
    neuro_id: partial.neuro ?? null,
  };
}

describe("buildCaseSummaryFallback", () => {
  it("prioriza o objetivo na queixa e no resumo (pt)", () => {
    const out = buildCaseSummaryFallback(
      snap({ extra: [{ label: "Objetivo (3 prioridades)", value: "Dormir melhor; menos ansiedade; mais energia" }] }),
      "pt-BR",
    );
    expect(out.chief.length).toBeGreaterThan(0);
    expect(out.summary).toContain("Objetivos do paciente");
    expect(out.summary).toContain("Dormir melhor");
  });

  it("agrega eixo prioritário do Neuro ID e medicamentos em uso", () => {
    const out = buildCaseSummaryFallback(
      snap({
        anamnese: "Fadiga há 6 meses",
        neuro: { indice_geral: 62, fisico_pct: 40, bioquimico_pct: 70, emocional_pct: 50, priority_pillar: "bioquimico", is_partial: true },
        prescriptions: [
          { type: "medication", name: "Levotiroxina", dosage: "50mcg", active: true },
          { type: "supplement", name: "Vitamina D", dosage: null, active: true },
          { type: "medication", name: "Antigo", dosage: null, active: false },
        ],
      }),
      "pt-BR",
    );
    expect(out.summary).toContain("Bioquímico");
    expect(out.summary).toContain("62%");
    expect(out.summary).toContain("leitura parcial");
    expect(out.summary).toContain("Levotiroxina");
    // Suplemento e medicamento inativo não entram na lista de medicamentos.
    expect(out.summary).not.toContain("Vitamina D");
    expect(out.summary).not.toContain("Antigo");
  });

  it("usa a anamnese quando não há objetivo", () => {
    const out = buildCaseSummaryFallback(snap({ anamnese: "Dor lombar recorrente após esforço." }), "pt-BR");
    expect(out.chief).toContain("Dor lombar");
  });

  it("nunca devolve travessão", () => {
    const out = buildCaseSummaryFallback(
      snap({ extra: [{ label: "Objetivo (3 prioridades)", value: "Dormir melhor — sem remédio" }], anamnese: "Queixa — fadiga" }),
      "pt-BR",
    );
    expect(out.chief).not.toContain("—");
    expect(out.summary).not.toContain("—");
  });

  it("respeita o idioma da clínica (en)", () => {
    const out = buildCaseSummaryFallback(
      snap({
        anamnese: "Chronic fatigue",
        neuro: { indice_geral: 55, fisico_pct: 30, bioquimico_pct: 55, emocional_pct: 40, priority_pillar: "emocional", is_partial: false },
        prescriptions: [{ type: "medication", name: "Sertraline", dosage: null, active: true }],
      }),
      "en",
    );
    expect(out.summary).toContain("Neuro ID map suggests");
    expect(out.summary).toContain("Medications in use");
    expect(out.summary).toContain("Bioemocional");
  });

  it("devolve strings vazias sem quebrar quando não há sinal", () => {
    const out = buildCaseSummaryFallback(snap({}), "pt-BR");
    expect(out.chief).toBe("");
    expect(out.summary).toBe("");
  });
});
