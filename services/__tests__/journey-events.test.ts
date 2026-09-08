import { describe, it, expect } from "vitest";
import { computeConversion, JOURNEY_EVENT_TYPES } from "@/services/journey-events-service";

const DAY = 24 * 60 * 60 * 1000;
// "agora" fixo para tornar o teste determinístico (janela aberta x fechada).
const NOW = Date.parse("2026-06-01T00:00:00Z");

// Helpers para montar âncoras relativas a NOW.
const daysAgo = (d: number) => NOW - d * DAY;

describe("journey-events — computeConversion (conversão avaliação→plano)", () => {
  it("conta como convertido quando o plano inicia dentro da janela de 45 dias", () => {
    const anchors = [
      { patientId: "p1", firstAssessmentAt: daysAgo(60), firstPlanAt: daysAgo(60) + 10 * DAY }, // 10 dias depois
    ];
    const r = computeConversion(anchors, 45, NOW);
    expect(r.cohort).toBe(1);
    expect(r.converted).toBe(1);
    expect(r.matureRate).toBe(1);
    expect(r.provisionalRate).toBe(1);
    expect(r.stillOpen).toBe(0);
    expect(r.maturedLost).toBe(0);
  });

  it("NÃO conta quando o plano inicia depois da janela (janela já fechada = perda)", () => {
    const anchors = [
      { patientId: "p1", firstAssessmentAt: daysAgo(90), firstPlanAt: daysAgo(90) + 50 * DAY }, // 50 > 45
    ];
    const r = computeConversion(anchors, 45, NOW);
    expect(r.converted).toBe(0);
    expect(r.stillOpen).toBe(0); // já passou dos 45 dias
    expect(r.maturedLost).toBe(1);
    expect(r.matureRate).toBe(0);
  });

  it("janela AINDA aberta (sem plano, mas dentro dos 45 dias) não conta como perda nem entra na base madura", () => {
    const anchors = [
      { patientId: "p1", firstAssessmentAt: daysAgo(10), firstPlanAt: null }, // T0 há 10 dias, sem plano
    ];
    const r = computeConversion(anchors, 45, NOW);
    expect(r.cohort).toBe(1);
    expect(r.converted).toBe(0);
    expect(r.stillOpen).toBe(1);
    expect(r.maturedCohort).toBe(0);
    expect(r.matureRate).toBeNull(); // base madura vazia → sem taxa madura
    expect(r.provisionalRate).toBe(0); // provisória conta a janela aberta no denominador
  });

  it("sem plano e janela fechada = perda madura (entra na base madura)", () => {
    const anchors = [
      { patientId: "p1", firstAssessmentAt: daysAgo(90), firstPlanAt: null },
    ];
    const r = computeConversion(anchors, 45, NOW);
    expect(r.cohort).toBe(1);
    expect(r.converted).toBe(0);
    expect(r.stillOpen).toBe(0);
    expect(r.maturedLost).toBe(1);
    expect(r.matureRate).toBe(0);
  });

  it("plano ANTES da avaliação, janela aberta: ainda pode converter → stillOpen", () => {
    // Na query real este caso já vem com firstPlanAt=null (correção B ignora plano < T0).
    // No cálculo puro, um plano fora da janela válida com a janela ainda aberta é tratado
    // como aberto (pode converter), não como perda.
    const anchors = [
      { patientId: "p1", firstAssessmentAt: daysAgo(30), firstPlanAt: daysAgo(40) }, // plano é anterior ao T0
    ];
    const r = computeConversion(anchors, 45, NOW);
    expect(r.converted).toBe(0);
    expect(r.stillOpen).toBe(1);
    expect(r.maturedLost).toBe(0);
  });

  it("mistura: taxa madura ignora janelas abertas; provisória não", () => {
    const anchors = [
      { patientId: "a", firstAssessmentAt: daysAgo(60), firstPlanAt: daysAgo(60) + 5 * DAY }, // convertido
      { patientId: "b", firstAssessmentAt: daysAgo(60), firstPlanAt: daysAgo(60) + 5 * DAY }, // convertido
      { patientId: "c", firstAssessmentAt: daysAgo(90), firstPlanAt: null }, // perda madura
      { patientId: "d", firstAssessmentAt: daysAgo(5), firstPlanAt: null }, // aberto
    ];
    const r = computeConversion(anchors, 45, NOW);
    expect(r.cohort).toBe(4);
    expect(r.converted).toBe(2);
    expect(r.stillOpen).toBe(1);
    expect(r.maturedLost).toBe(1);
    expect(r.maturedCohort).toBe(3);
    expect(r.matureRate).toBeCloseTo(2 / 3); // 2 convertidos / (2 + 1 perda madura)
    expect(r.provisionalRate).toBe(0.5); // 2 / 4 (subestima por causa do aberto)
  });

  it("sem avaliações no período → taxas null (nada a dividir)", () => {
    const r = computeConversion([], 45, NOW);
    expect(r.cohort).toBe(0);
    expect(r.converted).toBe(0);
    expect(r.matureRate).toBeNull();
    expect(r.provisionalRate).toBeNull();
  });
});

describe("journey-events — vocabulário fechado", () => {
  it("inclui as duas âncoras da métrica", () => {
    expect(JOURNEY_EVENT_TYPES).toContain("assessment_completed");
    expect(JOURNEY_EVENT_TYPES).toContain("plan_started");
  });
});
