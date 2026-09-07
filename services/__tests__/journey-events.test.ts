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
    expect(r.denominator).toBe(1);
    expect(r.numerator).toBe(1);
    expect(r.rate).toBe(1);
    expect(r.stillOpen).toBe(0);
  });

  it("NÃO conta quando o plano inicia depois da janela (janela já fechada = perda)", () => {
    const anchors = [
      { patientId: "p1", firstAssessmentAt: daysAgo(90), firstPlanAt: daysAgo(90) + 50 * DAY }, // 50 > 45
    ];
    const r = computeConversion(anchors, 45, NOW);
    expect(r.numerator).toBe(0);
    expect(r.stillOpen).toBe(0); // já passou dos 45 dias
    expect(r.rate).toBe(0);
  });

  it("janela AINDA aberta (sem plano, mas dentro dos 45 dias) não conta como perda", () => {
    const anchors = [
      { patientId: "p1", firstAssessmentAt: daysAgo(10), firstPlanAt: null }, // T0 há 10 dias, sem plano
    ];
    const r = computeConversion(anchors, 45, NOW);
    expect(r.denominator).toBe(1);
    expect(r.numerator).toBe(0);
    expect(r.stillOpen).toBe(1);
  });

  it("sem plano e janela fechada = perda (denominador conta, numerador não)", () => {
    const anchors = [
      { patientId: "p1", firstAssessmentAt: daysAgo(90), firstPlanAt: null },
    ];
    const r = computeConversion(anchors, 45, NOW);
    expect(r.denominator).toBe(1);
    expect(r.numerator).toBe(0);
    expect(r.stillOpen).toBe(0);
  });

  it("plano ANTES da avaliação não conta como conversão daquela avaliação", () => {
    const anchors = [
      { patientId: "p1", firstAssessmentAt: daysAgo(30), firstPlanAt: daysAgo(40) }, // plano é anterior ao T0
    ];
    const r = computeConversion(anchors, 45, NOW);
    expect(r.numerator).toBe(0);
    // janela ainda aberta (T0 há 30 dias) mas há um firstPlanAt (fora da janela válida),
    // então não é "stillOpen" (só conta stillOpen quando firstPlanAt é null).
    expect(r.stillOpen).toBe(0);
  });

  it("mistura: taxa = convertidos / total", () => {
    const anchors = [
      { patientId: "a", firstAssessmentAt: daysAgo(60), firstPlanAt: daysAgo(60) + 5 * DAY }, // convertido
      { patientId: "b", firstAssessmentAt: daysAgo(60), firstPlanAt: daysAgo(60) + 5 * DAY }, // convertido
      { patientId: "c", firstAssessmentAt: daysAgo(90), firstPlanAt: null }, // perda
      { patientId: "d", firstAssessmentAt: daysAgo(5), firstPlanAt: null }, // aberto
    ];
    const r = computeConversion(anchors, 45, NOW);
    expect(r.denominator).toBe(4);
    expect(r.numerator).toBe(2);
    expect(r.stillOpen).toBe(1);
    expect(r.rate).toBe(0.5);
  });

  it("sem avaliações no período → rate null (nada a dividir)", () => {
    const r = computeConversion([], 45, NOW);
    expect(r.denominator).toBe(0);
    expect(r.numerator).toBe(0);
    expect(r.rate).toBeNull();
  });
});

describe("journey-events — vocabulário fechado", () => {
  it("inclui as duas âncoras da métrica", () => {
    expect(JOURNEY_EVENT_TYPES).toContain("assessment_completed");
    expect(JOURNEY_EVENT_TYPES).toContain("plan_started");
  });
});
