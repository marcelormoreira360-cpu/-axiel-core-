import { describe, it, expect } from "vitest";
import { buildAiInsightSystemPrompt } from "@/modules/ai-insights/guardrails";
import {
  SUPPLEMENT_REASONING_VERSION,
  supplementReasoningFilters,
} from "@/modules/ai-insights/supplement-reasoning";

describe("supplementReasoningFilters (Protocolo dos 10 Filtros)", () => {
  const block = supplementReasoningFilters;

  it("carrega a regra-mãe (nenhum achado gera suplemento diretamente)", () => {
    expect(block).toContain("nenhum achado gera suplemento diretamente");
  });

  it("cobre os 10 filtros essenciais", () => {
    // 1 validade da fonte
    expect(block).toContain("VALIDADE DA FONTE");
    expect(block).toMatch(/biorress|reatividade|neurometria/i);
    // 3 não empilhar
    expect(block).toContain("NÃO EMPILHAR");
    // 6 cautela adaptógenos/precursores sem afirmar mecanismo
    expect(block).toMatch(/rhodiola/i);
    expect(block).toMatch(/ashwagandha/i);
    expect(block).toContain('afirme que "aumentam o simpático"');
    // 7 precursor serotoninérgico é gate
    expect(block).toContain("PRECURSORES SEROTONINÉRGICOS");
    expect(block).toMatch(/ISRS|IMAO|triptano/);
    // 8 probiótico com cepa + UFC
    expect(block).toMatch(/CEPA/);
    expect(block).toMatch(/UFC/);
    // 9 reatividade não é alergia
    expect(block).toContain("reatividade de teste NÃO é alergia");
    // 10 coerência de status
    expect(block).toContain("COERÊNCIA DE STATUS");
  });

  it("carimba a versão da configuração no bloco", () => {
    expect(block).toContain(SUPPLEMENT_REASONING_VERSION);
  });

  it("resolve o conflito de contagem: prevalece sobre a cobertura e exige faseamento", () => {
    // Filtro 3 (começar enxuto) x cobertura total pré-existente: a cláusula de
    // precedência precisa cobrir explicitamente a "cobertura de eixos", não só os exemplos.
    expect(block).toMatch(/PREVALECEM sobre TODA[\s\S]*cobertura de eixos/);
    expect(block).toMatch(/PRIORIZADA e FASEADA/);
  });
});

describe("buildAiInsightSystemPrompt integra os filtros no Documento 2", () => {
  it("injeta o Protocolo dos 10 Filtros no prompt do relatório", () => {
    const prompt = buildAiInsightSystemPrompt("pt-BR");
    expect(prompt).toContain("PROTOCOLO DOS 10 FILTROS");
    expect(prompt).toContain(SUPPLEMENT_REASONING_VERSION);
    // o bloco vem dentro da seção DOCUMENTO 2 (suplementação)
    const doc2Index = prompt.indexOf('DOCUMENTO 2 — "protocolo_suplementacao"');
    const filtrosIndex = prompt.indexOf("PROTOCOLO DOS 10 FILTROS");
    expect(doc2Index).toBeGreaterThanOrEqual(0);
    expect(filtrosIndex).toBeGreaterThan(doc2Index);
  });
});
