import { describe, it, expect } from "vitest";
import { coverageFromAnswers, pillarCoverageState, isPartialCoverage } from "../coverage";

describe("coverage do Mapa Bio³", () => {
  it("físico só com autorrelato (bm_*) fica 'aguardando_exame' (nunca completo)", () => {
    const answered = new Set(["bm_dor", "bm_rigidez", "bf_palpitacoes", "be_mood_humor"]);
    expect(pillarCoverageState("fisico", answered)).toBe("aguardando_exame");
    // biofuncional e emocional com sinal do paciente = leitura exibível
    expect(pillarCoverageState("bioquimico", answered)).toBe("completo");
    expect(pillarCoverageState("emocional", answered)).toBe("completo");
  });

  it("físico sem nenhum item = 'sem_dados'", () => {
    const answered = new Set(["bf_palpitacoes"]);
    expect(pillarCoverageState("fisico", answered)).toBe("sem_dados");
  });

  it("físico com exame presencial parcial = 'parcial'; completo = 'completo'", () => {
    const parcial = new Set(["bm_dor", "dor", "restr_lombar"]); // alguns itens de exame
    expect(pillarCoverageState("fisico", parcial)).toBe("parcial");
  });

  it("pilar vazio = 'sem_dados'", () => {
    const cov = coverageFromAnswers(new Set());
    expect(cov.fisico).toBe("sem_dados");
    expect(cov.bioquimico).toBe("sem_dados");
    expect(cov.emocional).toBe("sem_dados");
  });

  it("isPartialCoverage: tudo que não é 'completo' é parcial", () => {
    expect(isPartialCoverage("completo")).toBe(false);
    expect(isPartialCoverage("aguardando_exame")).toBe(true);
    expect(isPartialCoverage("sem_dados")).toBe(true);
    expect(isPartialCoverage("parcial")).toBe(true);
  });
});
