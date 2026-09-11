import { describe, it, expect } from "vitest";
import { getPack, listPackIds, DEFAULT_CLINICAL_PACK_ID } from "@/modules/clinical-packs/registry";
import { resolveClinicalPackId, resolveClinicalPack } from "@/modules/clinical-packs/resolve";
import { genericPack } from "@/modules/clinical-packs/packs/generic";
import { bio3NeuroIdPack } from "@/modules/clinical-packs/packs/bio3-neuroid";
import { buildAiInsightSystemPrompt } from "@/modules/ai-insights/guardrails";
import { aiInsightJsonShape } from "@/modules/ai-insights/insight-schema";

describe("clinical-packs — registry", () => {
  it("lista os dois packs do dia 1", () => {
    const ids = listPackIds();
    expect(ids).toContain("bio3-neuroid");
    expect(ids).toContain("generic");
  });

  it("getPack resolve por id e cai no default em id inválido/vazio", () => {
    expect(getPack("generic").id).toBe("generic");
    expect(getPack("bio3-neuroid").id).toBe("bio3-neuroid");
    expect(getPack("nao-existe").id).toBe(DEFAULT_CLINICAL_PACK_ID);
    expect(getPack(undefined).id).toBe(DEFAULT_CLINICAL_PACK_ID);
    expect(getPack("").id).toBe(DEFAULT_CLINICAL_PACK_ID);
  });

  it("o default de fallback é o pack NEUTRO 'generic' (nunca o método proprietário)", () => {
    expect(DEFAULT_CLINICAL_PACK_ID).toBe("generic");
  });
});

describe("clinical-packs — resolução por clínica (fallback sem banco)", () => {
  // No ambiente de teste não há env de Supabase, então a leitura de clinics.clinical_pack_id
  // (migration 156) cai no fallback seguro. Isso prova que o motor nunca quebra se a leitura
  // do banco falhar por qualquer motivo (env ausente, rede, linha/coluna vazia) e que, na
  // dúvida, ele degrada para o pack NEUTRO 'generic' — nunca para o método proprietário.
  it("resolveClinicalPackId cai no default neutro quando não consegue ler o banco", async () => {
    expect(await resolveClinicalPackId("qualquer-clinic-id")).toBe(DEFAULT_CLINICAL_PACK_ID);
    expect(await resolveClinicalPackId(null)).toBe(DEFAULT_CLINICAL_PACK_ID);
    expect(await resolveClinicalPackId(undefined)).toBe(DEFAULT_CLINICAL_PACK_ID);
  });

  it("resolveClinicalPack devolve o pack NEUTRO 'generic' no fallback (sem banco)", async () => {
    // Sem env de Supabase a leitura falha e cai no neutro. Em produção, a IFWC recebe
    // 'bio3-neuroid' pelo binding explícito no banco, não por este fallback.
    const pack = await resolveClinicalPack("clinic-ifwc");
    expect(pack.id).toBe("generic");
  });
});

describe("clinical-packs — bio3-neuroid é wrapper fino (byte-a-byte)", () => {
  it("reexporta o prompt e o schema atuais sem alteração", () => {
    // Prova de zero regressão: o pack aponta para as MESMAS funções/objeto de hoje.
    expect(bio3NeuroIdPack.buildReportSystemPrompt("pt-BR")).toBe(buildAiInsightSystemPrompt("pt-BR"));
    expect(bio3NeuroIdPack.buildReportSystemPrompt("en")).toBe(buildAiInsightSystemPrompt("en"));
    expect(bio3NeuroIdPack.reportJsonShape).toBe(aiInsightJsonShape as unknown as Record<string, unknown>);
  });

  it("expõe os prompts de apoio (atm/scribe/caseSummary)", () => {
    expect(typeof bio3NeuroIdPack.assistantPrompts.atm("pt-BR")).toBe("string");
    expect(typeof bio3NeuroIdPack.assistantPrompts.scribe("pt-BR")).toBe("string");
    expect(typeof bio3NeuroIdPack.assistantPrompts.caseSummary("pt-BR")).toBe("string");
  });
});

describe("clinical-packs — capability de UI neuroId (isolamento Bio³)", () => {
  it("bio3-neuroid habilita a UI Neuro ID; generic NÃO", () => {
    expect(bio3NeuroIdPack.capabilities?.neuroId).toBe(true);
    expect(genericPack.capabilities?.neuroId).toBe(false);
  });
  it("via getPack: só o pack bio3 expõe neuroId=true", () => {
    expect(getPack("bio3-neuroid").capabilities?.neuroId).toBe(true);
    expect(getPack("generic").capabilities?.neuroId).toBe(false);
    // id desconhecido cai no default NEUTRO (generic) → sem Neuro ID.
    expect(getPack("nao-existe").capabilities?.neuroId).toBe(false);
  });
});

describe("clinical-packs — generic é horizontal e mínimo", () => {
  it("não emite campos do Neuro ID (mapa/plano/suplementação/hipersensibilidade)", () => {
    const out = genericPack.coerceReportOutput({
      structured_summary: { overview: "Resumo", key_context: ["a"], current_status: "estável" },
      patterns_and_correlations: [{ title: "P", insight: "i", related_inputs: ["Questionários"] }],
      practitioner_review_points: ["rever intake"],
      data_limitations: ["falta exame"],
      // mesmo que o modelo mande campos Bio³, o pack generic os ignora:
      mapa_integrativo: { abertura_calorosa: "não deveria aparecer" },
      protocolo_suplementacao: { itens: [{ nome: "X" }] },
    });
    expect(out.structured_summary.overview).toBe("Resumo");
    expect(out.patterns_and_correlations[0]?.title).toBe("P");
    expect(out.mapa_integrativo).toBeUndefined();
    expect(out.plano_regulacao).toBeUndefined();
    expect(out.protocolo_suplementacao).toBeUndefined();
    expect(out.relatorio_hipersensibilidade).toBeUndefined();
  });

  it("mantém o rótulo de segurança e degrada com entrada vazia", () => {
    const out = genericPack.coerceReportOutput({});
    expect(out.label).toBe("AI-generated insights (not medical advice)");
    expect(out.safety_note).toContain("not medical advice");
    expect(Array.isArray(out.patterns_and_correlations)).toBe(true);
  });

  it("o prompt do relatório respeita o idioma de saída (i18n) sem string de UI nova", () => {
    const ptPrompt = genericPack.buildReportSystemPrompt("pt-BR");
    const enPrompt = genericPack.buildReportSystemPrompt("en");
    expect(ptPrompt).not.toBe(enPrompt); // languageInstruction muda por locale
    expect(ptPrompt).toContain("IDIOMA");
  });
});
