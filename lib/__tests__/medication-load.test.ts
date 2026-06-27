import { describe, it, expect } from "vitest";
import { medicationLoadValue, medicationLoadBand } from "../medication-load";

describe("medication-load", () => {
  it("mapa nº de remédios → valor 0-10 (0/verde/amarelo/vermelho)", () => {
    expect(medicationLoadValue(0)).toBe(0);
    expect(medicationLoadValue(1)).toBe(2);
    expect(medicationLoadValue(2)).toBe(2);
    expect(medicationLoadValue(3)).toBe(5);
    expect(medicationLoadValue(4)).toBe(5);
    expect(medicationLoadValue(5)).toBe(8);
    expect(medicationLoadValue(9)).toBe(8);
  });

  it("disfunção (valor × 10) cai na banda certa", () => {
    expect(medicationLoadValue(2) * 10).toBeLessThanOrEqual(30); // verde (Baixo)
    const amarelo = medicationLoadValue(3) * 10;
    expect(amarelo).toBeGreaterThan(30);
    expect(amarelo).toBeLessThanOrEqual(69);
    expect(medicationLoadValue(5) * 10).toBeGreaterThanOrEqual(70); // vermelho (Alto)
  });

  it("faixa de cor por contagem", () => {
    expect(medicationLoadBand(0)).toBe("sem_carga");
    expect(medicationLoadBand(2)).toBe("verde");
    expect(medicationLoadBand(4)).toBe("amarelo");
    expect(medicationLoadBand(6)).toBe("vermelho");
  });

  it("normaliza entrada inválida/negativa", () => {
    expect(medicationLoadValue(-3)).toBe(0);
    expect(medicationLoadValue(2.9)).toBe(2);
    expect(medicationLoadValue(NaN)).toBe(0);
  });
});
