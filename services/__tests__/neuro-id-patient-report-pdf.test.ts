import { describe, it, expect } from "vitest";
import { buildNeuroIdPatientReportPdf, type NeuroIdPdfMap } from "@/services/neuro-id-pdf-service";

const fullMap: NeuroIdPdfMap = {
  fisico_pct: 24, bioquimico_pct: 40, emocional_pct: 72,
  indice_geral: 45, priority_pillar: "emocional", is_partial: false,
};

function isPdf(buf: Buffer) {
  return Buffer.isBuffer(buf) && buf.subarray(0, 4).toString("latin1") === "%PDF";
}

describe("buildNeuroIdPatientReportPdf (anel Bio³ + equilíbrio)", () => {
  it("gera um PDF válido com o anel desenhado no pdfkit", async () => {
    const buf = await buildNeuroIdPatientReportPdf({ map: fullMap, patientName: "Ana Souza" });
    expect(isPdf(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("aguenta mapa parcial (valores nulos) sem quebrar", async () => {
    const partial: NeuroIdPdfMap = {
      fisico_pct: null, bioquimico_pct: null, emocional_pct: null,
      indice_geral: null, priority_pillar: null, is_partial: true,
    };
    const buf = await buildNeuroIdPatientReportPdf({ map: partial });
    expect(isPdf(buf)).toBe(true);
  });
});
