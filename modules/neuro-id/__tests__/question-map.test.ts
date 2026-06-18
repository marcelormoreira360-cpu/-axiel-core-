import { describe, it, expect } from "vitest";
import { DEFAULT_QUESTION_MAP, normalizeToDysfunction10 } from "../question-map";
import { CATALOG_BY_CODE } from "../catalog";

describe("normalizeToDysfunction10", () => {
  it("normaliza raw/max para 0–10", () => {
    expect(normalizeToDysfunction10(0, 16)).toBe(0);
    expect(normalizeToDysfunction10(16, 16)).toBe(10);
    expect(normalizeToDysfunction10(8, 16)).toBe(5);
    // PHQ-9 total 0–27
    expect(normalizeToDysfunction10(27, 27)).toBe(10);
    expect(Math.round(normalizeToDysfunction10(14, 27)! * 10) / 10).toBe(5.2);
  });
  it("max inválido ou raw nulo → null (pendente, não chuta)", () => {
    expect(normalizeToDysfunction10(5, 0)).toBeNull();
    expect(normalizeToDysfunction10(null, 16)).toBeNull();
    expect(normalizeToDysfunction10(5, null)).toBeNull();
  });
});

describe("DEFAULT_QUESTION_MAP", () => {
  it("todo catalog_code do de-para existe no catálogo", () => {
    for (const m of DEFAULT_QUESTION_MAP) {
      expect(CATALOG_BY_CODE[m.catalog_code], `code ${m.catalog_code}`).toBeTruthy();
    }
  });
  it("MSQ cobre os 3 pilares", () => {
    const pillars = new Set(
      DEFAULT_QUESTION_MAP
        .filter((m) => m.template_match === "MSQ")
        .map((m) => CATALOG_BY_CODE[m.catalog_code]?.pillar),
    );
    expect(pillars.has("fisico")).toBe(true);
    expect(pillars.has("bioquimico")).toBe(true);
    expect(pillars.has("emocional")).toBe(true);
  });
  it("articulações/músculos → biomecânico; mente/emoções → bioemocional", () => {
    const byCode = (c: string) => CATALOG_BY_CODE[c]?.pillar;
    expect(byCode("msq_joints_muscles")).toBe("fisico");
    expect(byCode("msq_mind")).toBe("emocional");
    expect(byCode("msq_emotions")).toBe("emocional");
    expect(byCode("msq_energy")).toBe("bioquimico");
  });
});
