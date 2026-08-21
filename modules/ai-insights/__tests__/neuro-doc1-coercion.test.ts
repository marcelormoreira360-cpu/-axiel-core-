import { describe, it, expect } from "vitest";
import { coerceAiInsightOutput } from "@/modules/ai-insights/insight-schema";
import {
  coerceCondutaEmocional,
  coerceFormatoAtendimento,
  coerceSuplementacaoStage,
  coerceClinicalFlags,
  DEFAULT_CONDUTA_EMOCIONAL,
} from "@/modules/ai-insights/neuro-enums";

describe("neuro-enums — coerção", () => {
  it("conduta_emocional: valor válido passa, inválido cai no default", () => {
    expect(coerceCondutaEmocional("no_documento")).toBe("no_documento");
    expect(coerceCondutaEmocional("qualquer_coisa")).toBe(DEFAULT_CONDUTA_EMOCIONAL);
    expect(coerceCondutaEmocional(undefined)).toBe("conduzida_pelo_profissional");
  });

  it("formato_atendimento e suplementacao_stage: enum ou undefined", () => {
    expect(coerceFormatoAtendimento("remoto")).toBe("remoto");
    expect(coerceFormatoAtendimento("presencial")).toBe("presencial");
    expect(coerceFormatoAtendimento("teletransporte")).toBeUndefined();
    expect(coerceSuplementacaoStage("ponteiro_doc3")).toBe("ponteiro_doc3");
    expect(coerceSuplementacaoStage("x")).toBeUndefined();
  });

  it("clinical_flags: allow-list descarta desconhecidas", () => {
    expect(coerceClinicalFlags(["depressao", "inventada", "gestacao"])).toEqual(["depressao", "gestacao"]);
    expect(coerceClinicalFlags("nao-array")).toEqual([]);
    expect(coerceClinicalFlags([])).toEqual([]);
  });
});

describe("coerceAiInsightOutput — Doc 1 persuasivo (6 seções)", () => {
  it("coage os campos novos do mapa_integrativo", () => {
    const out = coerceAiInsightOutput({
      mapa_integrativo: {
        abertura_calorosa: "  Olá, Amanda.  ",
        leitura_bio3: { titulo: "Retrato", descricao: "Seu corpo hoje" },
        leitura_neurometrica: [
          { titulo: "Sistema nervoso", descricao: "acelerado" },
          { titulo: "", descricao: "" },
        ],
        leitura_bioemocional: {
          temas: ["culpa", "perda", "família", "medo", "excesso-descartado"],
          sintese: "Uma carga emocional com peso.",
        },
        ancora_positiva: "Seus freios naturais estão preservados.",
        conexao_aha: "A emoção conversa com o corpo.",
        porque_agir_agora: "Agir agora joga a seu favor.",
        proximo_passo: "Vamos começar juntos.",
      },
    });
    const m = out.mapa_integrativo!;
    expect(m.abertura_calorosa).toBe("Olá, Amanda.");
    expect(m.leitura_bio3?.titulo).toBe("Retrato");
    // item vazio é descartado pelo filtro do coerceSecaoItens
    expect(m.leitura_neurometrica).toHaveLength(1);
    // temas limitados a 4
    expect(m.leitura_bioemocional?.temas).toHaveLength(4);
    expect(m.ancora_positiva).toContain("freios");
    expect(m.conexao_aha).toBeTruthy();
    expect(m.porque_agir_agora).toBeTruthy();
    expect(m.proximo_passo).toBeTruthy();
  });

  it("DESCARTA campos resolvidos no server vindos da LLM (segurança)", () => {
    const out = coerceAiInsightOutput({
      mapa_integrativo: {
        abertura_calorosa: "oi",
        conduta_emocional: "no_documento",
        clinical_flags: ["depressao", "ideacao_suicida"],
        crisis_hotline_block: { country: "BR", render: true, text: "188" },
      },
    });
    const m = out.mapa_integrativo!;
    // A LLM nunca controla crise/conduta: o coerce não seta esses campos.
    expect(m.conduta_emocional).toBeUndefined();
    expect(m.clinical_flags).toBeUndefined();
    expect(m.crisis_hotline_block).toBeUndefined();
  });
});

describe("coerceAiInsightOutput — Doc 2 (4 blocos)", () => {
  it("coage os campos novos do plano_regulacao", () => {
    const out = coerceAiInsightOutput({
      plano_regulacao: {
        onde_queremos_chegar: "Regular o sistema nervoso.",
        tres_pilares: { nervoso: "respiração", emocional: "no seu ritmo", estilo_de_vida: "sono" },
        como_caminhar_juntos: "sessões terapêuticas de acompanhamento",
        formato_atendimento: "remoto",
        suplementacao_stage: "ponteiro_doc3",
        conduta_emocional: "no_documento",
      },
    });
    const p = out.plano_regulacao!;
    expect(p.onde_queremos_chegar).toContain("Regular");
    expect(p.tres_pilares?.nervoso).toBe("respiração");
    expect(p.como_caminhar_juntos).toContain("sessões terapêuticas");
    expect(p.formato_atendimento).toBe("remoto");
    expect(p.suplementacao_stage).toBe("ponteiro_doc3");
    // conduta_emocional é resolvida no server; o coerce a descarta.
    expect(p.conduta_emocional).toBeUndefined();
  });
});
