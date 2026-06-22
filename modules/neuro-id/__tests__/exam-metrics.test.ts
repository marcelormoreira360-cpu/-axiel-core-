import { describe, it, expect } from "vitest";
import { examMetricContributions, pillarDysfunctionFromContributions } from "../exam-metrics";

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
