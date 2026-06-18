import { describe, it, expect } from "vitest";
import { DEFAULT_CATALOG } from "../catalog";
import { scoreItem, computeNeuroId, toEquilibrium, asScorable, type ScorableItem } from "../scoring";

const items = asScorable(DEFAULT_CATALOG);

function item(code: string): ScorableItem {
  const it = items.find((i) => i.code === code);
  if (!it) throw new Error(`item ${code} não encontrado`);
  return it;
}

describe("scoreItem", () => {
  it("scale_0_10 higher_worse: valor × 10", () => {
    expect(scoreItem(7, item("dor"))).toBe(70);
    expect(scoreItem(0, item("dor"))).toBe(0);
    expect(scoreItem(10, item("dor"))).toBe(100);
  });

  it("scale_0_10 higher_better: (10 − valor) × 10", () => {
    expect(scoreItem(8, item("mob_sacroiliaca"))).toBe(20);
    expect(scoreItem(10, item("mob_sacroiliaca"))).toBe(0);
    expect(scoreItem(0, item("mob_sacroiliaca"))).toBe(100);
  });

  it("med: nº de medicações × perItem, com teto", () => {
    expect(scoreItem(2, item("medicacao"))).toBe(40);
    expect(scoreItem(10, item("medicacao"))).toBe(100); // teto
    expect(scoreItem(0, item("medicacao"))).toBe(0);
  });

  it("lab: status → score; status desconhecido → null", () => {
    expect(scoreItem("moderado", item("exames_sangue_cabelo"))).toBe(50);
    expect(scoreItem("alto", item("exames_sangue_cabelo"))).toBe(85);
    expect(scoreItem("xyz", item("exames_sangue_cabelo"))).toBeNull();
  });

  it("valor ausente → null (dado faltando)", () => {
    expect(scoreItem("", item("dor"))).toBeNull();
    expect(scoreItem(null, item("dor"))).toBeNull();
    expect(scoreItem(undefined, item("dor"))).toBeNull();
  });
});

describe("computeNeuroId", () => {
  it("calcula 3 eixos, índice e prioridade (pilar de maior disfunção)", () => {
    const r = computeNeuroId(items, {
      // físico baixo (pouca disfunção)
      dor: 1, mob_sacroiliaca: 9, capsula_quadril: 9, lombar: 1,
      // emocional alto (muita disfunção) → deve ser prioridade
      tronco_simpatico: 9, plexo_cardiopulmonar: 8, vago_ganglio_cervical: 9,
      vago_orelha_temporal: 8, sutura_occipto_mastoide: 9, qsna: 9,
      relato_emocional: 8, sono: 9,
      // bioquímico médio
      intestino: 5, ciclo_hormonal: 5, qrm: 5,
    });
    expect(r.priorityPillar).toBe("emocional");
    expect(r.pillars.fisico.dysfunction).toBeLessThan(r.pillars.emocional.dysfunction!);
    expect(r.indiceGeral).not.toBeNull();
    expect(r.indiceGeral!).toBeGreaterThan(0);
  });

  it("dado faltando não quebra e marca isPartial (eixo sem itens = null)", () => {
    const r = computeNeuroId(items, { dor: 4, mob_sacroiliaca: 6 }); // só físico parcial
    expect(r.pillars.fisico.dysfunction).not.toBeNull();
    expect(r.pillars.bioquimico.dysfunction).toBeNull();
    expect(r.pillars.emocional.dysfunction).toBeNull();
    expect(r.isPartial).toBe(true);
    expect(r.pillars.fisico.itemsMissing).toBeGreaterThan(0);
  });

  it("itens 'partial' faltando viram CTA", () => {
    const r = computeNeuroId(items, { intestino: 3, ciclo_hormonal: 2, qrm: 4 });
    expect(r.pillars.bioquimico.missingCtaCodes).toContain("exames_sangue_cabelo");
  });
});

describe("toEquilibrium", () => {
  it("equilíbrio = 100 − disfunção", () => {
    expect(toEquilibrium(70)).toBe(30);
    expect(toEquilibrium(0)).toBe(100);
    expect(toEquilibrium(null)).toBeNull();
  });
});
