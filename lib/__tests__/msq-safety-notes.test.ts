import { describe, it, expect } from "vitest";
import {
  computeMsqSafetyFlags,
  type MsqAnswerWithContext,
} from "@/lib/msq-safety-notes";
import { gradeTotalByMode, isTopBand, normalizeScoringConfig } from "@/lib/assessment-grading";

// Config FINAL do MSQ da feira (modo ABSOLUTO por PONTOS) — espelha
// MSQ_scoring_config_FINAL.json (cortes 0-19/20-30/31-40/41-100/101+).
const MSQ_CONFIG = normalizeScoringConfig({
  mode: "absolute",
  total_bands: [
    { min: 0, max: 19, label: "Feeling steady", color: "#4CAF50" },
    { min: 20, max: 30, label: "Somewhere in between", color: "#8BC34A" },
    { min: 31, max: 40, label: "A few signals worth noticing", color: "#FFC107" },
    { min: 41, max: 100, label: "Several signals worth exploring", color: "#FF9800" },
    { min: 101, max: null, label: "Worth a closer look with a professional", color: "#B5603F" },
  ],
});

function ans(section: string, text: string, v: number | null): MsqAnswerWithContext {
  return { section_title: section, question_text: text, value_number: v };
}

describe("gradeTotalByMode — absolute (faixas por PONTOS)", () => {
  it("classifica pelo valor bruto do total, não pelo percentual", () => {
    expect(gradeTotalByMode(10, 300, MSQ_CONFIG)?.label).toBe("Feeling steady");
    expect(gradeTotalByMode(50, 300, MSQ_CONFIG)?.label).toBe("Several signals worth exploring");
  });

  it("limites inclusivos: 30 fica em '20-30', 31 sobe para '31-40'", () => {
    expect(gradeTotalByMode(30, 300, MSQ_CONFIG)?.label).toBe("Somewhere in between");
    expect(gradeTotalByMode(31, 300, MSQ_CONFIG)?.label).toBe("A few signals worth noticing");
  });

  it("faixa aberta 101+ (max null) captura scores altos", () => {
    expect(gradeTotalByMode(101, 300, MSQ_CONFIG)?.label).toBe("Worth a closer look with a professional");
    expect(gradeTotalByMode(250, 300, MSQ_CONFIG)?.label).toBe("Worth a closer look with a professional");
  });

  it("total 0 → Feeling steady", () => {
    expect(gradeTotalByMode(0, 300, MSQ_CONFIG)?.label).toBe("Feeling steady");
  });
});

describe("isTopBand — banda mais alta (101+)", () => {
  it("verdadeiro só para a banda de maior min", () => {
    expect(isTopBand(gradeTotalByMode(101, 300, MSQ_CONFIG), MSQ_CONFIG)).toBe(true);
    expect(isTopBand(gradeTotalByMode(100, 300, MSQ_CONFIG), MSQ_CONFIG)).toBe(false);
    expect(isTopBand(gradeTotalByMode(10, 300, MSQ_CONFIG), MSQ_CONFIG)).toBe(false);
  });

  it("null band → false", () => {
    expect(isTopBand(null, MSQ_CONFIG)).toBe(false);
  });
});

describe("computeMsqSafetyFlags — Cond. A (sentinela cardíaco/respiratório)", () => {
  it("dispara A com Chest pain = 3", () => {
    const flags = computeMsqSafetyFlags([ans("HEART", "Chest pain", 3)], false);
    expect(flags.showA).toBe(true);
  });

  it("dispara A com Shortness of breath = 4 (LUNGS)", () => {
    const flags = computeMsqSafetyFlags([ans("LUNGS", "Shortness of breath", 4)], false);
    expect(flags.showA).toBe(true);
  });

  it("NÃO dispara A com sentinela = 2", () => {
    const flags = computeMsqSafetyFlags([ans("HEART", "Chest pain", 2)], false);
    expect(flags.showA).toBe(false);
  });

  it("NÃO dispara A para item fora das seções sentinela", () => {
    const flags = computeMsqSafetyFlags([ans("HEAD", "Headaches", 4)], false);
    expect(flags.showA).toBe(false);
  });

  it("casa mesmo com variação de caixa/pontuação/acentos na seção e texto", () => {
    const flags = computeMsqSafetyFlags(
      [ans("heart", "chest pain!", 3)],
      false,
    );
    expect(flags.showA).toBe(true);
  });
});

describe("computeMsqSafetyFlags — Cond. B (banda mais alta 101+, sem A)", () => {
  it("dispara B quando está na banda mais alta e A não disparou", () => {
    const flags = computeMsqSafetyFlags([ans("HEAD", "Headaches", 4)], true);
    expect(flags.showB).toBe(true);
    expect(flags.showA).toBe(false);
  });

  it("NÃO dispara B se A disparou (prioridade), mesmo na banda alta", () => {
    const flags = computeMsqSafetyFlags([ans("HEART", "Chest pain", 4)], true);
    expect(flags.showA).toBe(true);
    expect(flags.showB).toBe(false);
  });

  it("NÃO dispara B fora da banda mais alta", () => {
    const flags = computeMsqSafetyFlags([ans("HEAD", "Headaches", 2)], false);
    expect(flags.showB).toBe(false);
  });
});

describe("computeMsqSafetyFlags — Cond. C (humor no nível máximo 4)", () => {
  it("dispara C com Depression = 4 (EMOTIONS)", () => {
    const flags = computeMsqSafetyFlags([ans("EMOTIONS", "Depression", 4)], false);
    expect(flags.showC).toBe(true);
  });

  it("dispara C com Mood swings = 4", () => {
    const flags = computeMsqSafetyFlags([ans("EMOTIONS", "Mood swings", 4)], false);
    expect(flags.showC).toBe(true);
  });

  it("NÃO dispara C com humor = 3 (só o máximo)", () => {
    const flags = computeMsqSafetyFlags([ans("EMOTIONS", "Depression", 3)], false);
    expect(flags.showC).toBe(false);
  });
});

describe("computeMsqSafetyFlags — coexistência A + C", () => {
  it("A e C coexistem; B não aparece", () => {
    const flags = computeMsqSafetyFlags(
      [ans("HEART", "Chest pain", 4), ans("EMOTIONS", "Depression", 4)],
      true,
    );
    expect(flags.showA).toBe(true);
    expect(flags.showC).toBe(true);
    expect(flags.showB).toBe(false);
  });

  it("nenhum flag em respostas leves e fora da banda alta", () => {
    const flags = computeMsqSafetyFlags(
      [ans("HEART", "Chest pain", 1), ans("EMOTIONS", "Depression", 2)],
      false,
    );
    expect(flags).toEqual({ showA: false, showB: false, showC: false });
  });
});
