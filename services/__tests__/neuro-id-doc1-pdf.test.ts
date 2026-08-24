import { describe, it, expect } from "vitest";
import { buildNeuroIdDoc1Pdf } from "@/services/neuro-id-pdf-service";
import { coerceAiInsightOutput } from "@/modules/ai-insights/insight-schema";
import type { NeuroMapaIntegrativo } from "@/lib/types";

function mapa(extra: Record<string, unknown> = {}): NeuroMapaIntegrativo {
  return coerceAiInsightOutput({
    mapa_integrativo: {
      identificacao: { paciente: "Amanda Camargo", idade: "24 anos", data_avaliacoes: "03/03/2026" },
      abertura_calorosa: "Amanda, obrigado por confiar o seu corpo e a sua história a este processo.",
      leitura_bio3: { titulo: "O seu retrato de hoje", descricao: "O seu corpo está acelerado por dentro e cansado por fora." },
      leitura_neurometrica: [
        { titulo: "Seu ritmo interno está acelerado", descricao: "a sua reação do corpo à emoção está muito alta." },
        { titulo: "Seu descanso não está restaurando", descricao: "o corpo tem dificuldade de entrar no modo de descanso." },
      ],
      leitura_bioemocional: { temas: ["culpa", "medo", "autocobrança"], sintese: "Uma carga emocional antiga que o corpo vem segurando." },
      ancora_positiva: "Os centros que comandam a calma ainda estão preservados.",
      conexao_aha: "O seu corpo aprendeu a viver em alerta para dar conta de um peso antigo.",
      porque_agir_agora: "Começar agora joga a seu favor, o corpo é adaptável.",
      proximo_passo: "Vamos começar juntos, no seu ritmo, com sessões terapêuticas de acompanhamento.",
      observacao: "Este documento não substitui avaliação médica.",
      ...extra,
    },
  }).mapa_integrativo!;
}

const bio3 = {
  fisico_pct: 40,
  bioquimico_pct: 58,
  emocional_pct: 71,
  indice_geral: 66,
  priority_pillar: "emocional" as const,
  is_partial: false,
};

describe("buildNeuroIdDoc1Pdf", () => {
  it("gera um PDF válido a partir das 8 seções", async () => {
    const pdf = await buildNeuroIdDoc1Pdf({ mapa: mapa(), bio3, patientName: "Amanda Camargo" });
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("funciona sem o mapa Bio³ (sem pirâmide)", async () => {
    const pdf = await buildNeuroIdDoc1Pdf({ mapa: mapa(), bio3: null });
    expect(pdf.length).toBeGreaterThan(0);
  });

  it("funciona com Doc 1 mínimo (só abertura)", async () => {
    const min = coerceAiInsightOutput({ mapa_integrativo: { abertura_calorosa: "Olá." } }).mapa_integrativo!;
    const pdf = await buildNeuroIdDoc1Pdf({ mapa: min });
    expect(pdf.length).toBeGreaterThan(0);
  });

  it("PDF completo é maior que o mínimo (as seções entram no conteúdo)", async () => {
    const full = await buildNeuroIdDoc1Pdf({ mapa: mapa(), bio3 });
    const min = await buildNeuroIdDoc1Pdf({
      mapa: coerceAiInsightOutput({ mapa_integrativo: { abertura_calorosa: "Olá." } }).mapa_integrativo!,
    });
    expect(full.length).toBeGreaterThan(min.length);
  });
});
