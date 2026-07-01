import { describe, it, expect } from "vitest";
import { formatFindingsSummary, qrmTotalLabel, qsnaTotalLabel, stripPreviousFindings, type FindingGroup } from "../findings";

describe("findings", () => {
  it("faixas do QRM", () => {
    expect(qrmTotalLabel(15)).toBe("baixo");
    expect(qrmTotalLabel(25)).toBe("limítrofe");
    expect(qrmTotalLabel(35)).toContain("acima de 30");
    expect(qrmTotalLabel(50)).toContain("acima de 40");
    expect(qrmTotalLabel(120)).toContain("acima de 100");
    expect(qrmTotalLabel(null)).toBeNull();
  });

  it("faixas do Q-SNA", () => {
    expect(qsnaTotalLabel(20)).toContain("equilibrada");
    expect(qsnaTotalLabel(60)).toContain("leve");
    expect(qsnaTotalLabel(90)).toContain("moderada");
    expect(qsnaTotalLabel(130)).toContain("grave");
  });

  it("cabeçalho: QRM=<total>, <faixa> (sem nome longo nem total cru), sem intro nem travessão", () => {
    const groups: FindingGroup[] = [
      {
        instrument: "QRM (Rastreamento Metabólico)", kind: "qrm", total: 42, max: 268,
        items: [
          { section: "Mente", text: "Memória ruim", value: 3 },
          { section: "Mente", text: "Concentração ruim", value: 3 },
          { section: "Emoções", text: "Depressão", value: 4 },
        ],
      },
    ];
    const out = formatFindingsSummary(groups, 3);
    expect(out).not.toContain("ACHADOS DOS QUESTIONÁRIOS");     // intro removida
    expect(out).not.toContain("total 42/268");                 // sem total cru
    expect(out).not.toContain("Rastreamento Metabólico");      // sem nome longo
    expect(out).toContain("QRM=42, acima de 40 (hipersensibilidade provável)");
    expect(out).toContain("Mente: Memória ruim (3); Concentração ruim (3)");
    expect(out).toContain("Emoções: Depressão (4)");
    expect(out).not.toContain("—"); // sem travessão
  });

  it("cabeçalho: Q-SNA=<total>, <faixa>", () => {
    const out = formatFindingsSummary([
      { instrument: "Q-SNA (Sistema Nervoso Autônomo)", kind: "qsna", total: 46, max: 180,
        items: [{ section: "Cardiovascular", text: "Palpitações", value: 3 }] },
    ], 3);
    expect(out).toContain("Q-SNA=46, disfunção leve (adaptativa)");
    expect(out).not.toContain("Sistema Nervoso Autônomo");
  });

  it("ignora grupos sem itens e retorna vazio quando não há achados", () => {
    expect(formatFindingsSummary([{ instrument: "QRM", kind: "qrm", total: 10, max: 268, items: [] }], 3)).toBe("");
    expect(formatFindingsSummary([], 3)).toBe("");
  });

  it("stripPreviousFindings remove o bloco anterior preservando o texto humano", () => {
    const prev = "Anotação do terapeuta.\n\nQRM: acima de 40 (hipersensibilidade provável)\n- Mente: Memória ruim (3)";
    expect(stripPreviousFindings(prev)).toBe("Anotação do terapeuta.");
    expect(stripPreviousFindings("Só texto humano, sem achados.")).toBe("Só texto humano, sem achados.");
  });

  it("stripPreviousFindings limpa o formato novo (QRM=) e a intro legada", () => {
    // Formato novo é deduplicado ao reimportar.
    const novo = "Nota.\n\nQRM=42, acima de 40 (hipersensibilidade provável)\n- Mente: Memória ruim (3)";
    expect(stripPreviousFindings(novo)).toBe("Nota.");

    // Texto legado (intro + cabeçalho longo) some por completo ao reimportar.
    const legado =
      "ACHADOS DOS QUESTIONÁRIOS (itens com pontuação 3 ou mais; revisar, corrigir e validar)\n\n" +
      "QRM (Rastreamento Metabólico) (total 42/268, acima de 40 (hipersensibilidade provável)):\n- CABEÇA: Dor de cabeça (3)";
    expect(stripPreviousFindings(legado)).toBe("");
  });
});
