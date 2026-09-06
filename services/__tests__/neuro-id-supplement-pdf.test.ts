import { describe, it, expect } from "vitest";
import { buildNeuroIdSupplementPdf } from "@/services/neuro-id-pdf-service";
import type { NeuroProtocoloSuplementacao } from "@/lib/types";

const protocolo: NeuroProtocoloSuplementacao = {
  itens: [
    { nome: "Magnésio glicinato", objetivo: "Apoio ao sono", dose_sugerida: "200 mg", forma: "cápsula", como_tomar: "1x à noite", buy_url: "https://exemplo.com/mag", observacao: "Validar com o profissional." },
    { nome: "Ômega-3 EPA/DHA", objetivo: "Apoio anti-inflamatório", dose_sugerida: "1000 mg", forma: "cápsula", como_tomar: "1x ao dia com alimento", observacao: "" },
  ],
  observacoes_gerais: ["Rascunho para validação profissional."],
};

function isPdf(buf: Buffer): boolean {
  return buf.length > 500 && buf.subarray(0, 5).toString("latin1") === "%PDF-";
}

describe("buildNeuroIdSupplementPdf", () => {
  it("gera PDF para paciente do Brasil (fórmula, sem link)", async () => {
    const buf = await buildNeuroIdSupplementPdf({ protocolo, country: "BR", patientName: "Fulano" });
    expect(isPdf(buf)).toBe(true);
  });

  it("gera PDF para paciente dos EUA (com link + aviso)", async () => {
    const buf = await buildNeuroIdSupplementPdf({ protocolo, country: "US", patientName: "John" });
    expect(isPdf(buf)).toBe(true);
  });

  it("não quebra com protocolo vazio", async () => {
    const buf = await buildNeuroIdSupplementPdf({ protocolo: { itens: [], observacoes_gerais: [] }, country: "BR" });
    expect(isPdf(buf)).toBe(true);
  });
});
