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

  it("pilar = média dos SUBDOMÍNIOS (não dos itens)", () => {
    // intestino → subdomínio "gi" (40); qsna_total → subdomínio "geral_qsna" (80).
    // Cada um sozinho no seu subdomínio → pilar = média dos 2 subdomínios = 60.
    const r = computeNeuroId(items, { intestino: 4, qsna_total: 8 });
    expect(Math.round(r.pillars.bioquimico.dysfunction!)).toBe(60);
  });

  it("subdomínio grave NÃO é diluído por área com muitos itens", () => {
    // 4 itens GI = 0 (subdomínio "gi" = 0) + 1 item de sono grave (subdomínio
    // "sono_ritmos" = 100). Média dos 2 subdomínios = 50 (antes seria 20, a média
    // achatada dos 5 itens). É o ponto da normalização por subdomínio.
    const r = computeNeuroId(items, {
      bf_refluxo: 0, bf_intestino: 0, bf_inchaco: 0, bf_dor_abdominal_estresse: 0,
      bf_sono_manter: 10,
    });
    expect(Math.round(r.pillars.bioquimico.dysfunction!)).toBe(50);
  });

  it("índice honesto: Biomecânico só com autorrelato (sem exame) fica FORA do índice", () => {
    // bm_dor (autorrelato, 80) + intestino (bioq 40) + be_mood_humor (emo 60). Sem exame físico.
    const semExame = computeNeuroId(items, { bm_dor: 8, intestino: 4, be_mood_humor: 6 });
    expect(semExame.pillars.fisico.dysfunction).not.toBeNull(); // pilar existe
    expect(Math.round(semExame.indiceGeral!)).toBe(50); // média só de bioq(40)+emo(60)
    // Com um item de EXAME presencial (dor), o físico passa a contar no índice.
    const comExame = computeNeuroId(items, { bm_dor: 8, dor: 8, intestino: 4, be_mood_humor: 6 });
    expect(Math.round(comExame.indiceGeral!)).toBe(60); // (80+40+60)/3
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

describe("computeNeuroId — fusão de exames (incremento 2)", () => {
  it("sem examValues → idêntico ao comportamento anterior (sem regressão)", () => {
    const base = { qrm_coracao: 6, intestino: 4 };
    const a = computeNeuroId(items, base);
    const b = computeNeuroId(items, base, undefined);
    expect(b.pillars.emocional.dysfunction).toBe(a.pillars.emocional.dysfunction);
    expect(b.pillars.bioquimico.dysfunction).toBe(a.pillars.bioquimico.dysfunction);
    expect(b.examContributions).toEqual([]);
    expect(b.pillars.emocional.examItemsUsed).toBe(0);
  });

  it("métrica de exame alimenta um pilar mesmo sem questionário", () => {
    // temperatura 28,82°C → disfunção 89,33; roteia emocional 0.6 + bioquímico 0.4
    const r = computeNeuroId(items, {}, { neuro_temperatura: 28.82 });
    expect(Math.round(r.pillars.emocional.dysfunction!)).toBe(89);
    expect(Math.round(r.pillars.bioquimico.dysfunction!)).toBe(89);
    expect(r.pillars.fisico.dysfunction).toBeNull(); // exame não toca o Biomecânico
    expect(r.pillars.emocional.examItemsUsed).toBe(1);
    expect(r.pillars.bioquimico.examItemsUsed).toBe(1);
    expect(r.examContributions).toHaveLength(2);
  });

  it("exame + questionário entram na MESMA média ponderada do pilar (§5)", () => {
    const q = computeNeuroId(items, { qrm_mente: 2 }); // emocional só do questionário (score 20)
    // sna_balance 70,97% → disfunção 41,94 no Bioemocional (peso 1)
    const f = computeNeuroId(items, { qrm_mente: 2 }, { neuro_sna_balance: 70.97 });
    const blended = f.pillars.emocional.dysfunction!;
    expect(blended).not.toBe(q.pillars.emocional.dysfunction);
    // média ponderada de dois valores distintos (20 e ~42) fica entre eles
    expect(blended).toBeGreaterThan(20);
    expect(blended).toBeLessThan(41.94);
    expect(f.pillars.emocional.examItemsUsed).toBe(1);
  });

  it("examContributions é rastreável (pilar, code, disfunção, peso)", () => {
    const r = computeNeuroId(items, {}, { neuro_barorreflexo: 96.44 });
    const baro = r.examContributions.find((c) => c.code === "neuro_barorreflexo");
    expect(baro).toMatchObject({ pillar: "bioquimico", dysfunction: 0, weight: 1 });
    expect(baro?.instrument).toBe("neurometria");
  });
});

describe("bands (semáforo)", () => {
  it("item 0–10 (4 níveis): ≤2.5 / ≤5 / ≤7.5 / >7.5", () => {
    expect(bandForItem(2)?.key).toBe("equilibrado");
    expect(bandForItem(4)?.key).toBe("atencao");
    expect(bandForItem(7)?.key).toBe("prioridade");
    expect(bandForItem(9)?.key).toBe("elevada");
  });
  it("disfunção 0–100 (4 níveis): 0–25 / 26–50 / 51–75 / 76–100 (limites)", () => {
    expect(bandForDysfunction(25)?.key).toBe("equilibrado");
    expect(bandForDysfunction(26)?.key).toBe("atencao");
    expect(bandForDysfunction(50)?.key).toBe("atencao");
    expect(bandForDysfunction(51)?.key).toBe("prioridade");
    expect(bandForDysfunction(75)?.key).toBe("prioridade");
    expect(bandForDysfunction(76)?.key).toBe("elevada");
    expect(bandForDysfunction(null)).toBeNull();
  });
  it("labelFor muda a palavra por tipo de item", () => {
    expect(labelFor("elevada", "mobility")).toBe("Bloqueado");
    expect(labelFor("atencao", "pain")).toBe("Moderada");
    expect(labelFor("equilibrado", "symptom")).toBe("Baixo");
    expect(labelFor("prioridade", "axis")).toBe("Prioridade de cuidado");
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
