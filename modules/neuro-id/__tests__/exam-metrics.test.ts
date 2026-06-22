import { describe, it, expect } from "vitest";
import {
  examMetricContributions,
  pillarDysfunctionFromContributions,
  buildMetricExtractionPrompt,
  coerceExamMetricsDraft,
  metricsForInstrument,
  mergeConfirmedMetrics,
} from "../exam-metrics";

// Valores reais do exame da Marizele (neurometria) + carga emocional estimada da biorressonância.
const MARIZELE = {
  neuro_controle_ansiedade: 73.24, // média do controle de ansiedade (%)
  neuro_hrv: 3,                    // marcador cardio-funcional (~+3, escala -4..+4)
  neuro_barorreflexo: 96.44,       // índice barorreflexo total (%)
  neuro_hemodinamica: 20.3,        // resposta hemodinâmica total (%)
  neuro_temperatura: 28.82,        // temperatura periférica média (°C)
  neuro_sna_balance: 70.97,        // frequência simpática (%)
  neuro_adaptativa: 60,            // capacidade adaptativa (%)
  bio_carga_emocional: 85,         // carga emocional da biorressonância (0–100)
};

describe("fusão Bio³ a partir de exames (Marizele)", () => {
  const contribs = examMetricContributions(MARIZELE);
  const emocional = pillarDysfunctionFromContributions(contribs, "emocional");
  const bioquimico = pillarDysfunctionFromContributions(contribs, "bioquimico");
  const fisico = pillarDysfunctionFromContributions(contribs, "fisico");

  it("computa pilares plausíveis a partir das métricas dos exames", () => {
    // log para validação visual
    console.log("PILARES (exame-derivados) Marizele:", {
      emocional: emocional && Math.round(emocional),
      bioquimico: bioquimico && Math.round(bioquimico),
      fisico,
    });
    console.log("CONTRIBUIÇÕES:", contribs.map((c) => `${c.pillar}:${c.code}=${Math.round(c.dysfunction)}%×${c.weight}`));

    expect(emocional).toBeGreaterThan(40);   // sobrecarga emocional relevante
    expect(emocional).toBeLessThan(70);
    expect(bioquimico).toBeGreaterThan(20);   // atenção circulatória/metabólica moderada
    expect(bioquimico).toBeLessThan(55);
    expect(fisico).toBeNull();                // neurometria/biorressonância não tocam o Biomecânico
  });

  it("barorreflexo ótimo (96,44%) contribui disfunção baixa (positivo)", () => {
    const baro = contribs.find((c) => c.code === "neuro_barorreflexo");
    expect(baro?.dysfunction).toBe(0); // (90-96,44)/20 < 0 -> travado em 0
  });

  it("temperatura 28,82 °C (faixa 31,5–32,5) gera disfunção alta", () => {
    const temp = contribs.find((c) => c.code === "neuro_temperatura");
    expect(temp).toBeDefined();
    expect(Math.round(temp!.dysfunction)).toBe(89); // (31,5-28,82)/3*100
  });

  it("só métricas presentes entram (ignora ausentes/null)", () => {
    const partial = examMetricContributions({ neuro_temperatura: 28.82, neuro_barorreflexo: null });
    expect(partial.every((c) => c.code === "neuro_temperatura")).toBe(true);
  });
});

describe("extração por IA das métricas (incremento 3)", () => {
  it("prompt escopa só os codes do instrumento + pede null p/ ausente", () => {
    const neuro = buildMetricExtractionPrompt("neurometria");
    expect(neuro).toContain("neuro_controle_ansiedade");
    expect(neuro).toContain("neuro_temperatura");
    expect(neuro).not.toContain("bio_carga_emocional"); // métrica de outro instrumento
    expect(neuro).toContain("retorne null");

    const bio = buildMetricExtractionPrompt("biorressonancia");
    expect(bio).toContain("bio_carga_emocional");
    expect(bio).not.toContain("neuro_temperatura");
    // todos os codes da neurometria aparecem no prompt da neurometria
    for (const m of metricsForInstrument("neurometria")) expect(neuro).toContain(m.code);
  });

  it("coerce aceita número/string com vírgula e escopa ao instrumento", () => {
    const draft = coerceExamMetricsDraft(
      {
        neuro_temperatura: "28,82",      // string com vírgula -> 28.82
        neuro_sna_balance: 70.97,         // número
        bio_carga_emocional: 85,          // métrica de OUTRO instrumento -> ignorada
        neuro_inexistente: 10,            // code desconhecido -> ignorado
      },
      "neurometria",
    );
    expect(draft.neuro_temperatura).toBeCloseTo(28.82, 2);
    expect(draft.neuro_sna_balance).toBe(70.97);
    expect(draft).not.toHaveProperty("bio_carga_emocional");
    expect(draft).not.toHaveProperty("neuro_inexistente");
  });

  it("coerce descarta null/não-finito e valores fora da faixa de sanidade", () => {
    const draft = coerceExamMetricsDraft(
      {
        neuro_controle_ansiedade: null,   // ausente
        neuro_barorreflexo: "abc",        // não-finito
        neuro_temperatura: 200,           // fora de [10,45] -> alucinação/unidade errada
        neuro_hrv: -3,                    // dentro de [-4,4] (pode ser negativo) -> mantém
        neuro_adaptativa: 60,             // ok
      },
      "neurometria",
    );
    expect(draft).not.toHaveProperty("neuro_controle_ansiedade");
    expect(draft).not.toHaveProperty("neuro_barorreflexo");
    expect(draft).not.toHaveProperty("neuro_temperatura");
    expect(draft.neuro_hrv).toBe(-3);
    expect(draft.neuro_adaptativa).toBe(60);
  });

  it("draft do coerce alimenta examMetricContributions de ponta a ponta", () => {
    const draft = coerceExamMetricsDraft({ neuro_temperatura: "28,82" }, "neurometria");
    const contribs = examMetricContributions(draft);
    const temp = contribs.find((c) => c.code === "neuro_temperatura");
    expect(Math.round(temp!.dysfunction)).toBe(89); // mesma conversão determinística
  });
});

describe("mergeConfirmedMetrics (incremento 5)", () => {
  it("funde exames confirmados; mais recente vence por métrica", () => {
    // rows em ordem cronológica (antigo -> recente)
    const merged = mergeConfirmedMetrics([
      { metrics_values: { neuro_temperatura: 30, neuro_barorreflexo: 80 } }, // antigo
      { metrics_values: { neuro_temperatura: 28.82, bio_carga_emocional: 85 } }, // recente
    ]);
    expect(merged.neuro_temperatura).toBe(28.82); // recente sobrescreve
    expect(merged.neuro_barorreflexo).toBe(80);   // só no antigo, mantém
    expect(merged.bio_carga_emocional).toBe(85);
  });

  it("ignora linhas vazias e codes desconhecidos / não-finitos", () => {
    const merged = mergeConfirmedMetrics([
      { metrics_values: null },
      { metrics_values: { codigo_inexistente: 5, neuro_hrv: 3 } },
      { metrics_values: { neuro_adaptativa: Number.NaN } as Record<string, number> },
    ]);
    expect(merged).toEqual({ neuro_hrv: 3 });
  });
});
