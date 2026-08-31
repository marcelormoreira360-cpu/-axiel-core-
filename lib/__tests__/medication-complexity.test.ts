import { describe, it, expect } from "vitest";
import { computeMedicationComplexity, medicationComplexityBand } from "../medication-complexity";

describe("medicationComplexityBand (faixas operacionais)", () => {
  it("mapeia as 4 faixas", () => {
    expect(medicationComplexityBand(0)).toBe("baixa");
    expect(medicationComplexityBand(25)).toBe("baixa");
    expect(medicationComplexityBand(26)).toBe("moderada");
    expect(medicationComplexityBand(50)).toBe("moderada");
    expect(medicationComplexityBand(51)).toBe("elevada");
    expect(medicationComplexityBand(75)).toBe("elevada");
    expect(medicationComplexityBand(76)).toBe("muito_elevada");
    expect(medicationComplexityBand(100)).toBe("muito_elevada");
  });
});

describe("computeMedicationComplexity", () => {
  it("zero em tudo → 0 / baixa", () => {
    const r = computeMedicationComplexity({ medicationCount: 0 });
    expect(r.score).toBe(0);
    expect(r.band).toBe("baixa");
  });

  it("caso máximo satura em 100 / muito_elevada", () => {
    const r = computeMedicationComplexity({
      medicationCount: 10, classCount: 6, autonomicFlagged: 5,
      adverseEffectsFreq: 3, adherenceDifficultyFreq: 3, recentChange: true,
    });
    expect(r.score).toBe(100);
    expect(r.band).toBe("muito_elevada");
  });

  it("caso intermediário soma os componentes", () => {
    // 4 meds = 15; 2 classes = 8; 1 autonômico = 5; adverso 0; adesão 0; sem mudança
    const r = computeMedicationComplexity({ medicationCount: 4, classCount: 2, autonomicFlagged: 1 });
    expect(r.components.medications).toBeCloseTo(15, 5);
    expect(r.components.classes).toBeCloseTo(8, 5);
    expect(r.components.autonomic).toBeCloseTo(5, 5);
    expect(r.score).toBe(28);
    expect(r.band).toBe("moderada");
  });

  it("não somar ao Global é responsabilidade de quem chama; aqui só devolve o índice isolado", () => {
    const r = computeMedicationComplexity({ medicationCount: 2 });
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
