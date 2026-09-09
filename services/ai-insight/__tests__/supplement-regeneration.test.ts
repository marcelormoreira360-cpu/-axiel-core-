import { describe, it, expect } from "vitest";
import { mergeRegeneratedSupplement } from "@/services/ai-insight/supplement-merge";
import type { AiInsightOutput } from "@/lib/types";

const base = (over: Partial<AiInsightOutput>): AiInsightOutput => ({
  label: "AI-generated insights (not medical advice)",
  structured_summary: { overview: "", key_context: [], current_status: "" },
  patterns_and_correlations: [],
  practitioner_review_points: [],
  data_limitations: [],
  safety_note: "x",
  ...over,
});

describe("mergeRegeneratedSupplement", () => {
  it("sem relatório aprovado anterior, usa o output fresco inteiro", () => {
    const fresh = base({
      protocolo_suplementacao: { intro: "novo" } as any,
      supplement_reasoning_version: "2026-09-suplementacao-10-filtros",
    });
    expect(mergeRegeneratedSupplement(null, fresh)).toBe(fresh);
  });

  it("com relatório aprovado, preserva Doc 1 e Doc 3 e troca só a suplementação", () => {
    const previous = base({
      mapa_integrativo: { titulo: "Doc1 aprovado" } as any,
      plano_regulacao: { fase: "aprovada" } as any,
      relatorio_hipersensibilidade: { introducao: "Doc3 aprovado" } as any,
      protocolo_suplementacao: { intro: "suplementação ANTIGA" } as any,
      supplement_reasoning_version: "versao-antiga",
      practitioner_review_points: ["ficha antiga"],
    });
    const fresh = base({
      mapa_integrativo: { titulo: "Doc1 NOVO (descartar)" } as any,
      protocolo_suplementacao: { intro: "suplementação NOVA" } as any,
      supplement_reasoning_version: "2026-09-suplementacao-10-filtros",
      practitioner_review_points: ["ficha nova (interações dos novos ativos)"],
    });

    const merged = mergeRegeneratedSupplement(previous, fresh);

    // Doc 1 e Doc 3 aprovados: preservados (não reescreve o que o paciente já recebeu)
    expect(merged.mapa_integrativo).toBe(previous.mapa_integrativo);
    expect(merged.plano_regulacao).toBe(previous.plano_regulacao);
    expect(merged.relatorio_hipersensibilidade).toBe(previous.relatorio_hipersensibilidade);
    // Documento 2 + carimbo + ficha interna: vêm do fresco
    expect(merged.protocolo_suplementacao).toBe(fresh.protocolo_suplementacao);
    expect(merged.supplement_reasoning_version).toBe("2026-09-suplementacao-10-filtros");
    expect(merged.practitioner_review_points).toEqual(["ficha nova (interações dos novos ativos)"]);
  });

  it("fresco SEM suplementação não apaga o Doc 2 aprovado (devolve o aprovado intacto)", () => {
    const previous = base({
      protocolo_suplementacao: { intro: "suplementação aprovada" } as any,
      supplement_reasoning_version: "versao-aprovada",
    });
    const freshVazio = base({ protocolo_suplementacao: undefined });
    expect(mergeRegeneratedSupplement(previous, freshVazio)).toBe(previous);
  });
});
