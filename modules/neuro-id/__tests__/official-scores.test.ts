import { describe, it, expect } from "vitest";
import { computePhq9, computeGad7, computeOfficialScores, phq9Band, gad7Band } from "../official-scores";

describe("escores oficiais PHQ-9 / GAD-7", () => {
  it("PHQ-9 soma os 9 itens (0–27) e marca completo", () => {
    const a: Record<string, number> = {};
    for (let i = 1; i <= 9; i++) a[`phq9_${i}`] = 2; // 9 × 2 = 18
    const s = computePhq9(a);
    expect(s.total).toBe(18);
    expect(s.max).toBe(27);
    expect(s.complete).toBe(true);
    expect(s.band).toBe("moderadamente grave"); // 15–19
  });

  it("GAD-7 soma os 7 itens (0–21)", () => {
    const a: Record<string, number> = {};
    for (let i = 1; i <= 7; i++) a[`gad7_${i}`] = 2; // 14
    const s = computeGad7(a);
    expect(s.total).toBe(14);
    expect(s.max).toBe(21);
    expect(s.complete).toBe(true);
    expect(s.band).toBe("moderada"); // 10–14
  });

  it("incompleto: soma o que veio mas complete=false", () => {
    const s = computePhq9({ phq9_1: 3, phq9_2: 3 });
    expect(s.total).toBe(6);
    expect(s.answered).toBe(2);
    expect(s.complete).toBe(false);
  });

  it("faixas oficiais", () => {
    expect(phq9Band(4)).toBe("mínima");
    expect(phq9Band(10)).toBe("moderada");
    expect(phq9Band(27)).toBe("grave");
    expect(gad7Band(9)).toBe("leve");
    expect(gad7Band(10)).toBe("moderada"); // corte de rastreio
    expect(gad7Band(21)).toBe("grave");
  });

  it("computeOfficialScores devolve os dois", () => {
    const r = computeOfficialScores({ phq9_1: 1, gad7_1: 3 });
    expect(r.phq9.total).toBe(1);
    expect(r.gad7.total).toBe(3);
  });
});
