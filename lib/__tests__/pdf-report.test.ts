import { describe, it, expect } from "vitest";
import { buildTablePdf } from "../pdf-report";

// Helper: builds a UTF-16BE Buffer for a given string (no BOM).
// PDFKit stores PDF Info strings (Title, Author) as "(þÿ<UTF-16BE bytes>)".
function utf16be(str: string): Buffer {
  const buf = Buffer.alloc(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    buf[i * 2]     = (code >> 8) & 0xff;
    buf[i * 2 + 1] = code & 0xff;
  }
  return buf;
}

describe("buildTablePdf", () => {
  const baseOpts = {
    title: "Relatório de Receitas",
    clinicName: "Clínica Teste",
    headers: ["Paciente", "Valor", "Data"],
    rows: [
      ["João Silva", "R$ 200,00", "2026-05-01"],
      ["Maria Santos", "R$ 150,00", "2026-05-02"],
    ],
  };

  it("retorna um Buffer", async () => {
    const result = await buildTablePdf(baseOpts);
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it("o PDF tem conteúdo (length > 0)", async () => {
    const result = await buildTablePdf(baseOpts);
    expect(result.length).toBeGreaterThan(0);
  });

  it("o buffer contém o título e o clinicName no dicionário Info do PDF", async () => {
    const result = await buildTablePdf(baseOpts);
    // PDFKit stores PDF Info strings as UTF-16BE with a þÿ (0xFEFF) BOM.
    // We search for the UTF-16BE bytes of each string (without BOM).
    expect(result.includes(utf16be("Relatório de Receitas"))).toBe(true);
    expect(result.includes(utf16be("Clínica Teste"))).toBe(true);
  });

  it("o PDF com summary é maior do que sem summary (campo opcional)", async () => {
    // Page content streams are compressed (FlateDecode), so we cannot search
    // for plain text. Instead we verify the summary adds bytes to the output.
    const withoutSummary = await buildTablePdf({ ...baseOpts });
    const withSummary    = await buildTablePdf({ ...baseOpts, summary: "Total: R$ 350,00" });
    expect(withSummary.length).toBeGreaterThan(withoutSummary.length);
  });

  it("funciona sem summary (campo opcional ausente)", async () => {
    const result = await buildTablePdf({ ...baseOpts });
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("funciona com rows vazias", async () => {
    const result = await buildTablePdf({ ...baseOpts, rows: [] });
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});
