import { describe, it, expect } from "vitest";
import { formatFindingsSummary, qrmTotalLabel, qsnaTotalLabel, type FindingGroup } from "../findings";

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

  it("agrupa por instrumento e seção, sem travessão, e mostra a pontuação", () => {
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
    expect(out).toContain("ACHADOS DOS QUESTIONÁRIOS");
    expect(out).toContain("total 42/268");
    expect(out).toContain("Mente: Memória ruim (3); Concentração ruim (3)");
    expect(out).toContain("Emoções: Depressão (4)");
    expect(out).not.toContain("—"); // sem travessão
  });

  it("ignora grupos sem itens e retorna vazio quando não há achados", () => {
    expect(formatFindingsSummary([{ instrument: "QRM", kind: "qrm", total: 10, max: 268, items: [] }], 3)).toBe("");
    expect(formatFindingsSummary([], 3)).toBe("");
  });
});
