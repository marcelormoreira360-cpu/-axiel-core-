import { describe, it, expect } from "vitest";
import { computeMadrsS, madrsSBand, MADRS_S_ITEMS } from "../madrs-s";

describe("MADRS-S (pontuação, sem conteúdo protegido)", () => {
  it("soma os 9 itens 0–6 no total 0–54 e marca completo", () => {
    const a: Record<string, number> = {};
    for (const c of MADRS_S_ITEMS) a[c] = 3; // 9 × 3 = 27
    const s = computeMadrsS(a);
    expect(s.total).toBe(27);
    expect(s.max).toBe(54);
    expect(s.complete).toBe(true);
    expect(s.band).toBe("moderada"); // 20–34
  });

  it("incompleto: soma o que veio, complete=false", () => {
    const s = computeMadrsS({ madrs_s_1: 6, madrs_s_2: 6 });
    expect(s.total).toBe(12);
    expect(s.answered).toBe(2);
    expect(s.complete).toBe(false);
  });

  it("faixas oficiais 0–54", () => {
    expect(madrsSBand(12)).toBe("mínima");
    expect(madrsSBand(13)).toBe("leve");
    expect(madrsSBand(20)).toBe("moderada");
    expect(madrsSBand(35)).toBe("grave");
    expect(madrsSBand(54)).toBe("grave");
  });

  it("valores fora de 0–6 são saturados", () => {
    const s = computeMadrsS({ madrs_s_1: 10, madrs_s_2: -3 });
    expect(s.total).toBe(6); // 6 + 0
  });
});
