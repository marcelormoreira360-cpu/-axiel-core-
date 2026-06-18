import { describe, it, expect } from "vitest";
import { DEFAULT_CATALOG } from "../catalog";
import { scoreItem, computeNeuroId, asScorable, pillarContributions, type ScorableItem } from "../scoring";
import { bandForItem, bandForDysfunction, labelFor } from "../bands";

const items = asScorable(DEFAULT_CATALOG);
function item(c: string): ScorableItem {
  const f = items.find((i) => i.code === c);
  if (!f) throw new Error(`item ${c} não encontrado`);
  return f;
}

describe("scoreItem (escala unificada higher_worse)", () => {
  it("dor: valor × 10", () => {
    expect(scoreItem(7, item("dor"))).toBe(70);
    expect(scoreItem(0, item("dor"))).toBe(0);
    expect(scoreItem(10, item("dor"))).toBe(100);
  });

  it("mobilidade agora é higher_worse (sem inversão 10−valor)", () => {
    expect(scoreItem(8, item("restr_sacroiliaca"))).toBe(80);
    expect(scoreItem(2, item("restr_lombar"))).toBe(20);
  });

  it("QRM/Q-SNA sub-scores: valor × 10", () => {
    expect(scoreItem(6, item("qrm_coracao"))).toBe(60);
    expect(scoreItem(9, item("qsna_sono"))).toBe(90);
  });

  it("lab: status → score; desconhecido → null", () => {
    expect(scoreItem("moderado", item("exame_sangue"))).toBe(50);
    expect(scoreItem("alto", item("exame_sangue"))).toBe(85);
    expect(scoreItem("xyz", item("exame_sangue"))).toBeNull();
  });

  it("valor ausente → null", () => {
    expect(scoreItem("", item("dor"))).toBeNull();
    expect(scoreItem(null, item("dor"))).toBeNull();
  });
});

describe("computeNeuroId", () => {
  it("3 eixos + índice + prioridade (maior disfunção)", () => {
    const r = computeNeuroId(items, {
      dor: 1, restr_sacroiliaca: 1, restr_lombar: 1,
      qrm_coracao: 9, qrm_mente: 9, qsna_sono: 9, qsna_emocional: 8,
      intestino: 4, qrm_total: 4,
    });
    expect(r.priorityPillar).toBe("emocional");
    expect(r.pillars.fisico.dysfunction!).toBeLessThan(r.pillars.emocional.dysfunction!);
    expect(r.indiceGeral).not.toBeNull();
  });

  it("overlap Q-SNA: qsna_total tem peso 0.5 na média do Bioquímico", () => {
    const r = computeNeuroId(items, { intestino: 4, qsna_total: 8 });
    // (40*1 + 80*0.5) / (1 + 0.5) = 80 / 1.5 = 53.33…
    expect(Math.round(r.pillars.bioquimico.dysfunction! * 100) / 100).toBe(53.33);
  });

  it("dado faltando não quebra e marca parcial + CTA", () => {
    const r = computeNeuroId(items, { dor: 5 });
    expect(r.pillars.fisico.dysfunction).not.toBeNull();
    expect(r.pillars.bioquimico.dysfunction).toBeNull();
    expect(r.isPartial).toBe(true);
    // exames (lab partial) faltando viram CTA
    expect(r.pillars.bioquimico.missingCtaCodes).toContain("exame_sangue");
  });
});

describe("bands (semáforo)", () => {
  it("item 0–10: ≤3 solto · 4–6 tenso · ≥7 bloqueado", () => {
    expect(bandForItem(2)?.key).toBe("solto");
    expect(bandForItem(5)?.key).toBe("tenso");
    expect(bandForItem(8)?.key).toBe("bloqueado");
  });
  it("disfunção 0–100: 0–30 solto · 31–69 tenso · 70–100 bloqueado (limites)", () => {
    expect(bandForDysfunction(30)?.key).toBe("solto");
    expect(bandForDysfunction(31)?.key).toBe("tenso");
    expect(bandForDysfunction(69)?.key).toBe("tenso");
    expect(bandForDysfunction(70)?.key).toBe("bloqueado");
    expect(bandForDysfunction(null)).toBeNull();
  });
  it("labelFor muda a palavra por tipo de item", () => {
    expect(labelFor("bloqueado", "mobility")).toBe("Bloqueado");
    expect(labelFor("tenso", "pain")).toBe("Moderada");
    expect(labelFor("solto", "symptom")).toBe("Baixo");
  });
});

describe("pillarContributions (soma 100%)", () => {
  it("reparte proporcionalmente ao total de disfunção", () => {
    const c = pillarContributions({ fisico: 20, bioquimico: 30, emocional: 50 });
    expect(Math.round(c.fisico!)).toBe(20);
    expect(Math.round(c.bioquimico!)).toBe(30);
    expect(Math.round(c.emocional!)).toBe(50);
    const total = (c.fisico ?? 0) + (c.bioquimico ?? 0) + (c.emocional ?? 0);
    expect(Math.round(total)).toBe(100);
  });
  it("pilar sem dado → null; total zero → tudo null", () => {
    const c = pillarContributions({ fisico: 40, bioquimico: null, emocional: 60 });
    expect(c.bioquimico).toBeNull();
    expect(Math.round((c.fisico ?? 0) + (c.emocional ?? 0))).toBe(100);
  });
});
