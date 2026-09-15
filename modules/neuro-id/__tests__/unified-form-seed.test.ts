import { describe, it, expect } from "vitest";
import { buildUnifiedSeed, unifiedSeedCodes, convertQuestion } from "../unified-form-seed";
import { CATALOG_BY_CODE } from "../catalog";
import { unifiedScaleKind, processUnifiedForm } from "../unified-form-import";

describe("convertQuestion", () => {
  it("sintoma freqimp vira 2 perguntas de escala 0–3 com códigos _freq/_imp", () => {
    const out = convertQuestion({ code: "bf_palpitacoes", label: "Palpitações", type: "freqimp" });
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ code: "bf_palpitacoes_freq", question_type: "scale", min_score: 0, max_score: 3 });
    expect(out[1]).toMatchObject({ code: "bf_palpitacoes_imp", question_type: "scale", max_score: 3 });
    expect(out[0].options).toHaveLength(4);
  });
  it("humor 0–6 vira 1 escala com rótulos de âncora por opção", () => {
    const out = convertQuestion({ code: "be_mood_humor", label: "Ânimo", type: "scale", max: 6, anchors: { 0: "Bem", 6: "Pesado" } });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ code: "be_mood_humor", question_type: "scale", max_score: 6 });
    expect(out[0].options?.[0]).toBe("Bem");
    expect(out[0].options?.[6]).toBe("Pesado");
  });
  it("info não vira pergunta", () => {
    expect(convertQuestion({ code: "x", label: "cabeçalho", type: "info" })).toEqual([]);
  });
});

describe("buildUnifiedSeed", () => {
  const seed = buildUnifiedSeed();
  it("tem 8 seções (A–H) com títulos prefixados", () => {
    expect(seed.sections).toHaveLength(8);
    expect(seed.sections[0].title).toMatch(/^A —/);
  });
  it("instruções trazem o disclaimer de não-emergência", () => {
    expect(seed.instructions).toContain("não é um serviço de emergência");
  });
  it("não há código duplicado nas perguntas semeadas", () => {
    const codes = unifiedSeedCodes();
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("round-trip: seed → resposta por código → Bio³ (motor)", () => {
  it("todo código pontuável do catálogo tem as respostas que a fiação espera", () => {
    const codes = new Set(unifiedSeedCodes());
    // Códigos LEGADO do catálogo (bloco emocional antigo) NÃO estão no formulário novo
    // — ele usa PHQ-9/GAD-7 oficiais. Ficam no catálogo só p/ dados históricos.
    const isLegacy = (c: string) =>
      c.startsWith("be_mood_") || c.startsWith("be_anx_") || c === "be_reg_irritabilidade" || c === "be_reg_culpa";
    for (const c of Object.keys(CATALOG_BY_CODE)) {
      const kind = unifiedScaleKind(c);
      if (!kind || isLegacy(c)) continue;
      // Cada tipo semeia UMA pergunta com o próprio código; a chave bate 1:1 com o import.
      expect(codes.has(c), c).toBe(true);
    }
  });

  it("respostas por código alimentam os pilares via processUnifiedForm", () => {
    const answers = {
      bm_dor: 3,            // gravidade 0–4
      bf_palpitacoes: 2,    // gravidade 0–4
      be_mood_humor: 4, be_anx_nervosismo: 2,
    };
    const r = processUnifiedForm(answers);
    expect(r.bio3Values.bm_dor).toBeGreaterThan(0);
    expect(r.bio3Values.bf_palpitacoes).toBeGreaterThan(0);
    expect(r.bio3Values.be_mood_humor).toBeGreaterThan(0);
    expect(r.bio3Values.be_anx_nervosismo).toBeGreaterThan(0);
  });
});
