import { describe, it, expect } from "vitest";
import { bio3FromAnswerRows } from "../unified-form-result";
import { buildQuestionRows, convertQuestion } from "../unified-form-seed";

describe("buildQuestionRows", () => {
  it("gera linhas com code, options e order_index", () => {
    const qs = convertQuestion({ code: "bf_falta_ar", label: "Falta de ar", type: "freqimp" });
    const rows = buildQuestionRows("tpl", "sec", qs, 0);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ template_id: "tpl", section_id: "sec", code: "bf_falta_ar_freq", order_index: 0 });
    expect(rows[1].order_index).toBe(1);
    expect(Array.isArray(rows[0].options)).toBe(true);
  });
  it("options vira null quando ausente (texto/sim-não)", () => {
    const qs = convertQuestion({ code: "med_usa", label: "Toma remédio?", type: "yes_no" });
    const rows = buildQuestionRows("t", "s", qs);
    expect(rows[0].options).toBeNull();
  });
});

describe("bio3FromAnswerRows (gatilho ponta a ponta)", () => {
  it("respostas por código → 3 pilares + segurança + ICM", () => {
    const rows = [
      { code: "bm_dor_freq", value: 3 }, { code: "bm_dor_imp", value: 3 },
      { code: "bf_fadiga_freq", value: 2 }, { code: "bf_fadiga_imp", value: 2 },
      { code: "bf_falta_ar_freq", value: 2 }, { code: "bf_falta_ar_imp", value: 0 },
      { code: "be_mood_humor", value: 4 }, { code: "be_anx_nervosismo", value: 3 },
      { code: "be_crisis_gosto_vida", value: 3 },
      { code: null, value: 5 }, // linha legada sem code é ignorada
    ];
    const out = bio3FromAnswerRows(rows, { medicationCount: 3, classCount: 2 });
    expect(out.neuro.pillars.fisico.dysfunction).not.toBeNull();
    expect(out.neuro.pillars.bioquimico.dysfunction).not.toBeNull(); // Biofuncional
    expect(out.neuro.pillars.emocional.dysfunction).not.toBeNull();
    expect(out.neuro.indiceGeral).not.toBeNull();
    // segurança: falta de ar freq 2 (impacto 0) dispara mesmo sem carga; crise dispara
    expect(out.safety.cardioresp).toBe(true);
    expect(out.safety.crisis).toBe(true);
    // ICM separado, presente
    expect(out.medication?.score).toBeGreaterThan(0);
    // ideação não entra no score
    expect(out.bio3Values).not.toHaveProperty("be_crisis_gosto_vida");
  });

  it("sem medInput não calcula ICM", () => {
    const out = bio3FromAnswerRows([{ code: "bf_fadiga_freq", value: 2 }, { code: "bf_fadiga_imp", value: 2 }]);
    expect(out.medication).toBeNull();
  });
});
