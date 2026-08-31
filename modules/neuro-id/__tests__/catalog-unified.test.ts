import { describe, it, expect } from "vitest";
import { CATALOG_BY_CODE } from "../catalog";

/**
 * Trava a taxonomia CORRIGIDA do formulário unificado (2026-08):
 * autonômico/cardiorresp/digestivo/sono/cognição no Biofuncional (chave `bioquimico`),
 * Bioemocional só com humor/ansiedade/regulação, ideação FORA do score.
 */
describe("catálogo do formulário unificado — taxonomia corrigida", () => {
  const pillar = (c: string) => CATALOG_BY_CODE[c]?.pillar;

  it("Biomecânico recebe os bm_*", () => {
    for (const c of ["bm_dor", "bm_rigidez", "bm_limitacao", "bm_equilibrio", "bm_fraqueza_muscular"]) {
      expect(pillar(c), c).toBe("fisico");
    }
  });

  it("Biofuncional recebe autonômico/digestivo/sono/cognição (bf_*)", () => {
    for (const c of [
      "bf_palpitacoes", "bf_desconforto_toracico", "bf_falta_ar", "bf_intestino",
      "bf_sono_iniciar", "bf_fadiga", "bf_concentracao", "bf_brain_fog", "bf_hormonal",
    ]) {
      expect(pillar(c), c).toBe("bioquimico");
    }
  });

  it("Bioemocional fica LIMPO: só humor/ansiedade/regulação", () => {
    for (const c of [
      "be_mood_humor", "be_mood_envolvimento", "be_anx_nervosismo",
      "be_anx_relaxar", "be_reg_irritabilidade", "be_reg_recuperar_estresse",
    ]) {
      expect(pillar(c), c).toBe("emocional");
    }
  });

  it("o item de ideação NÃO entra no catálogo (não pontua)", () => {
    expect(CATALOG_BY_CODE["be_crisis_gosto_vida"]).toBeUndefined();
  });

  it("nenhum bf_* (autonômico) caiu no Bioemocional", () => {
    const bfEmocional = Object.values(CATALOG_BY_CODE).filter(
      (i) => i.code.startsWith("bf_") && i.pillar === "emocional",
    );
    expect(bfEmocional).toEqual([]);
  });
});
