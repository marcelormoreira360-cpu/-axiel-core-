import { describe, it, expect } from "vitest";
import { UNIFIED_FORM } from "../unified-form-template";
import { CATALOG_BY_CODE } from "../catalog";
import { unifiedScaleKind } from "../unified-form-import";

const allQuestions = UNIFIED_FORM.blocks.flatMap((b) => b.questions.map((q) => ({ ...q, block: b })));

describe("coerência template ↔ catálogo ↔ fiação", () => {
  it("todo item pontuado (scale, exceto ideação) existe no catálogo, no pilar do bloco", () => {
    for (const q of allQuestions) {
      if (!q.block.scored) continue;
      if (q.type !== "scale") continue;
      if (q.crisisIfPositive) continue; // PHQ-9 nº9: pontua o total oficial, não o pilar → fora do catálogo
      const def = CATALOG_BY_CODE[q.code];
      expect(def, `catálogo faltando ${q.code}`).toBeTruthy();
      if (q.block.pillar) expect(def.pillar, q.code).toBe(q.block.pillar);
    }
  });

  it("o item de ideação (PHQ-9 nº9) NÃO está no catálogo (não pontua o pilar)", () => {
    const ideacao = allQuestions.find((q) => q.crisisIfPositive);
    expect(ideacao?.code).toBe("phq9_9");
    expect(CATALOG_BY_CODE["phq9_9"]).toBeUndefined();
  });

  it("todo item pontuado é reconhecido pela fiação de import", () => {
    for (const q of allQuestions) {
      if (!q.block.scored || q.type !== "scale") continue;
      if (q.crisisIfPositive) continue; // ideação não entra no pilar
      expect(unifiedScaleKind(q.code), `fiação não reconhece ${q.code}`).not.toBeNull();
    }
  });

  it("cobertura reversa: todo código bm_/bf_ do catálogo aparece no formulário", () => {
    // bm_/bf_ (físico/biofuncional) devem estar 100% no formulário. Os be_* emocionais
    // agora são LEGADO no catálogo (o formulário usa PHQ-9/GAD-7 oficiais), então não
    // entram nesta cobertura reversa.
    const formCodes = new Set(allQuestions.map((q) => q.code));
    const catalogNew = Object.keys(CATALOG_BY_CODE).filter(
      (c) => c.startsWith("bm_") || c.startsWith("bf_"),
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
