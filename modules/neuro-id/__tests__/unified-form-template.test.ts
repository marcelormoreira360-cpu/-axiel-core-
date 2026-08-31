import { describe, it, expect } from "vitest";
import { UNIFIED_FORM } from "../unified-form-template";
import { CATALOG_BY_CODE } from "../catalog";
import { unifiedScaleKind } from "../unified-form-import";

const allQuestions = UNIFIED_FORM.blocks.flatMap((b) => b.questions.map((q) => ({ ...q, block: b })));

describe("coerência template ↔ catálogo ↔ fiação", () => {
  it("todo item pontuado (freqimp/scale, exceto crise) existe no catálogo, no pilar do bloco", () => {
    for (const q of allQuestions) {
      if (!q.block.scored) continue;
      if (q.type !== "freqimp" && q.type !== "scale") continue;
      const def = CATALOG_BY_CODE[q.code];
      expect(def, `catálogo faltando ${q.code}`).toBeTruthy();
      if (q.block.pillar) expect(def.pillar, q.code).toBe(q.block.pillar);
    }
  });

  it("o item de ideação NÃO está no catálogo (não pontua)", () => {
    const crisis = allQuestions.find((q) => q.type === "crisis");
    expect(crisis?.code).toBe("be_crisis_gosto_vida");
    expect(CATALOG_BY_CODE["be_crisis_gosto_vida"]).toBeUndefined();
  });

  it("todo item pontuado é reconhecido pela fiação de import", () => {
    for (const q of allQuestions) {
      if (!q.block.scored || (q.type !== "freqimp" && q.type !== "scale")) continue;
      expect(unifiedScaleKind(q.code), `fiação não reconhece ${q.code}`).not.toBeNull();
    }
  });

  it("cobertura reversa: todo código bm_/bf_/be_ do catálogo aparece no formulário", () => {
    const formCodes = new Set(allQuestions.map((q) => q.code));
    const catalogNew = Object.keys(CATALOG_BY_CODE).filter(
      (c) => c.startsWith("bm_") || c.startsWith("bf_") || c.startsWith("be_"),
    );
    for (const c of catalogNew) {
      expect(formCodes.has(c), `formulário faltando ${c}`).toBe(true);
    }
  });

  it("não há código duplicado no formulário", () => {
    const codes = allQuestions.map((q) => q.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("estrutura: 8 blocos A–H", () => {
    expect(UNIFIED_FORM.blocks.map((b) => b.key)).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"]);
  });
});
