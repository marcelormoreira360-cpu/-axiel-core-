import { describe, it, expect } from "vitest";
import { combineFreqImp, freqImpToScale10 } from "../questionnaire-scale";

describe("combineFreqImp (carga = freq × impacto, 0–9)", () => {
  it("multiplica frequência e impacto", () => {
    expect(combineFreqImp(2, 3)).toBe(6);
    expect(combineFreqImp(3, 1)).toBe(3);
    expect(combineFreqImp(3, 3)).toBe(9);
  });
  it("freq 0 = 0 (impacto nem é perguntado)", () => {
    expect(combineFreqImp(0, undefined)).toBe(0);
    expect(combineFreqImp(0, 3)).toBe(0);
  });
  it("freq ausente = null (dado faltando)", () => {
    expect(combineFreqImp(null, 2)).toBeNull();
    expect(combineFreqImp(undefined, 2)).toBeNull();
    expect(combineFreqImp("abc", 2)).toBeNull();
  });
  it("freq ≥ 1 com impacto ausente = null (não zera falsamente)", () => {
    expect(combineFreqImp(2, null)).toBeNull();
    expect(combineFreqImp(2, undefined)).toBeNull();
  });
  it("satura em 0–3 por dimensão", () => {
    expect(combineFreqImp(9, 9)).toBe(9); // clamp 3×3
  });
});

describe("freqImpToScale10 (0–9 → escala 0–10 do motor)", () => {
  it("converte proporcionalmente", () => {
    expect(freqImpToScale10(3, 3)).toBeCloseTo(10, 5); // 9/9*10
    expect(freqImpToScale10(0, 0)).toBe(0);
    expect(freqImpToScale10(2, 3)).toBeCloseTo((6 / 9) * 10, 5);
  });
  it("null quando incompleto", () => {
    expect(freqImpToScale10(2, null)).toBeNull();
  });
});
