import { describe, it, expect } from "vitest";
import { dysfunctionToBalance } from "../bands";

describe("dysfunctionToBalance (OXIEL dual language — ponto único de tradução)", () => {
  it("caso de referência: disfunção → equilíbrio (100 − disfunção)", () => {
    expect(dysfunctionToBalance(24)).toBe(76);
    expect(dysfunctionToBalance(40)).toBe(60);
    expect(dysfunctionToBalance(72)).toBe(28);
    expect(dysfunctionToBalance(45)).toBe(55); // índice geral
  });

  it("null/NaN preservam null (dado pendente)", () => {
    expect(dysfunctionToBalance(null)).toBeNull();
    expect(dysfunctionToBalance(Number.NaN)).toBeNull();
    expect(dysfunctionToBalance(Infinity)).toBeNull();
  });

  it("arredonda num único ponto", () => {
    expect(dysfunctionToBalance(72.4)).toBe(28); // 27.6 → 28
    expect(dysfunctionToBalance(0.5)).toBe(100); // 99.5 → 100
  });

  it("limita 0–100 (nunca extrapola)", () => {
    expect(dysfunctionToBalance(0)).toBe(100);
    expect(dysfunctionToBalance(100)).toBe(0);
    expect(dysfunctionToBalance(120)).toBe(0);
    expect(dysfunctionToBalance(-20)).toBe(100);
  });
});
