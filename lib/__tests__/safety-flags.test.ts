import { describe, it, expect } from "vitest";
import { cardiorespFlag, crisisFlag, evaluateSafetyFlags } from "../safety-flags";

describe("cardiorespFlag (freq isolada ≥ 2, impacto ignorado)", () => {
  it("dispara com desconforto torácico frequente mesmo sem impacto", () => {
    expect(cardiorespFlag({ bf_desconforto_toracico_freq: 2 })).toBe(true);
    expect(cardiorespFlag({ bf_desconforto_toracico_freq: 3, bf_desconforto_toracico_imp: 0 })).toBe(true);
  });
  it("dispara por falta de ar ou palpitação frequentes", () => {
    expect(cardiorespFlag({ bf_falta_ar_freq: 2 })).toBe(true);
    expect(cardiorespFlag({ bf_palpitacoes_freq: 3 })).toBe(true);
  });
  it("não dispara com frequência baixa", () => {
    expect(cardiorespFlag({ bf_falta_ar_freq: 1, bf_palpitacoes_freq: 0 })).toBe(false);
    expect(cardiorespFlag({})).toBe(false);
  });
  it("aceita string e ignora valores inválidos", () => {
    expect(cardiorespFlag({ bf_palpitacoes_freq: "2" })).toBe(true);
    expect(cardiorespFlag({ bf_palpitacoes_freq: "abc" })).toBe(false);
  });
});

describe("crisisFlag (gatilho binário ≥ 3, não é nível de risco)", () => {
  it("dispara a partir de 3", () => {
    expect(crisisFlag({ be_crisis_gosto_vida: 3 })).toBe(true);
    expect(crisisFlag({ be_crisis_gosto_vida: 6 })).toBe(true);
  });
  it("não dispara abaixo de 3", () => {
    expect(crisisFlag({ be_crisis_gosto_vida: 2 })).toBe(false);
    expect(crisisFlag({})).toBe(false);
  });
});

describe("evaluateSafetyFlags", () => {
  it("combina os dois sinais", () => {
    expect(evaluateSafetyFlags({ bf_falta_ar_freq: 2, be_crisis_gosto_vida: 3 })).toEqual({
      cardioresp: true,
      crisis: true,
    });
    expect(evaluateSafetyFlags({})).toEqual({ cardioresp: false, crisis: false });
  });
});
