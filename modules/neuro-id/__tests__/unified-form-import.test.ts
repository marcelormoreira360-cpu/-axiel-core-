import { describe, it, expect } from "vitest";
import { buildUnifiedBio3Values, processUnifiedForm, unifiedScaleKind } from "../unified-form-import";
import { computeNeuroId, asScorable } from "../scoring";
import { DEFAULT_CATALOG } from "../catalog";

const items = asScorable(DEFAULT_CATALOG);

describe("unifiedScaleKind", () => {
  it("classifica pelo prefixo", () => {
    expect(unifiedScaleKind("bm_dor")).toBe("sev4");
    expect(unifiedScaleKind("bf_palpitacoes")).toBe("sev4");
    expect(unifiedScaleKind("bf_apneia")).toBe("scale3"); // exceção: rastreio 0–3
    expect(unifiedScaleKind("be_mood_humor")).toBe("mood6");
    expect(unifiedScaleKind("be_anx_nervosismo")).toBe("scale3");
    expect(unifiedScaleKind("be_reg_culpa")).toBe("scale3");
    expect(unifiedScaleKind("qrm_coracao")).toBeNull(); // legado, ignorado
  });
});

describe("buildUnifiedBio3Values", () => {
  it("sintoma: gravidade 0–4 → 0–10", () => {
    const v = buildUnifiedBio3Values({ bf_palpitacoes: 4 });
    expect(v.bf_palpitacoes).toBeCloseTo(10, 5); // 4/4*10
    const v2 = buildUnifiedBio3Values({ bf_falta_ar: 2 });
    expect(v2.bf_falta_ar).toBeCloseTo(5, 5); // 2/4*10
    const v3 = buildUnifiedBio3Values({ bm_dor: 0 });
    expect(v3.bm_dor).toBe(0); // "Nunca" pontua 0 (não some)
  });
  it("RETROCOMPAT: respostas antigas em freq×impacto ainda mapeiam", () => {
    const v = buildUnifiedBio3Values({ bf_palpitacoes_freq: 3, bf_palpitacoes_imp: 3 });
    expect(v.bf_palpitacoes).toBeCloseTo(10, 5); // 9/9*10
    const v2 = buildUnifiedBio3Values({ bf_falta_ar_freq: 2, bf_falta_ar_imp: 3 });
    expect(v2.bf_falta_ar).toBeCloseTo((6 / 9) * 10, 5);
    // a gravidade nova tem prioridade sobre o par legado, se ambos vierem
    const v3 = buildUnifiedBio3Values({ bm_dor: 4, bm_dor_freq: 0 });
    expect(v3.bm_dor).toBeCloseTo(10, 5);
  });
  it("humor 0–6 e ansiedade/regulação 0–3 escalam para 0–10", () => {
    const v = buildUnifiedBio3Values({ be_mood_humor: 6, be_anx_nervosismo: 3, be_reg_culpa: 0 });
    expect(v.be_mood_humor).toBeCloseTo(10, 5);
    expect(v.be_anx_nervosismo).toBeCloseTo(10, 5);
    expect(v.be_reg_culpa).toBe(0);
  });
  it("ignora legados e ideação (não pontua)", () => {
    const v = buildUnifiedBio3Values({ qrm_coracao: 8, be_crisis_gosto_vida: 6 });
    expect(v).not.toHaveProperty("qrm_coracao");
    expect(v).not.toHaveProperty("be_crisis_gosto_vida");
  });
});

describe("processUnifiedForm (ponta a ponta com o motor)", () => {
  it("os valores alimentam os pilares certos", () => {
    const answers = {
      bm_dor: 4,                          // Biomecânico alto (gravidade 0–4)
      bf_fadiga: 3,                       // Biofuncional
      be_mood_humor: 4, be_anx_nervosismo: 2,  // Bioemocional
      bf_desconforto_toracico: 2,         // segurança cardiorrespiratória (gravidade ≥2)
      be_crisis_gosto_vida: 3,            // gatilho de crise
    };
    const r = processUnifiedForm(answers);
    const neuro = computeNeuroId(items, r.bio3Values);
    expect(neuro.pillars.fisico.dysfunction).not.toBeNull();
    expect(neuro.pillars.bioquimico.dysfunction).not.toBeNull(); // Biofuncional
    expect(neuro.pillars.emocional.dysfunction).not.toBeNull();
    // segurança: cardiorrespiratório pela gravidade do sintoma + crise, fora do score
    expect(r.safety.cardioresp).toBe(true);
    expect(r.safety.crisis).toBe(true);
    expect(neuro.pillars.bioquimico.dysfunction!).toBeGreaterThan(0);
  });

  it("ICM só entra se houver input de medicação (separado do Global)", () => {
    const semMed = processUnifiedForm({ bf_fadiga: 2 });
    expect(semMed.medication).toBeNull();
    const comMed = processUnifiedForm({}, { medicationCount: 4, classCount: 2 });
    expect(comMed.medication?.score).toBeGreaterThan(0);
  });
});
