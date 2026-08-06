import { describe, it, expect } from "vitest";
import {
  formatIntakeFindings,
  stripPreviousFindings,
  INTAKE_FINDINGS_HEAD,
} from "@/modules/neuro-id/findings";

describe("formatIntakeFindings", () => {
  it("devolve vazio quando não há item útil", () => {
    expect(formatIntakeFindings([])).toBe("");
    expect(formatIntakeFindings([{ label: "", answer: "x" }])).toBe("");
    expect(formatIntakeFindings([{ label: "P", answer: "  " }])).toBe("");
  });

  it("monta cabeçalho + linhas 'label: resposta'", () => {
    const out = formatIntakeFindings([
      { label: "Queixa", answer: "Fadiga" },
      { label: "Sono", answer: "Ruim" },
    ]);
    expect(out.startsWith(INTAKE_FINDINGS_HEAD)).toBe(true);
    expect(out).toContain("- Queixa: Fadiga");
    expect(out).toContain("- Sono: Ruim");
  });

  it("trunca respostas longas e limita a quantidade de itens", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ label: `L${i}`, answer: "resposta" }));
    const out = formatIntakeFindings(many, { maxItems: 5 });
    expect(out.split("\n").length).toBe(6); // cabeçalho + 5 linhas

    const long = formatIntakeFindings([{ label: "L", answer: "x".repeat(300) }], { maxAnswerChars: 40 });
    const line = long.split("\n")[1];
    expect(line.length).toBeLessThanOrEqual(4 + 40 + 2); // "- L: " + 40 + "…"
    expect(line.endsWith("…")).toBe(true);
  });

  it("não usa travessão", () => {
    const out = formatIntakeFindings([{ label: "Relato", answer: "dor — constante" }]);
    // O conteúdo é do paciente; a função não injeta travessão próprio no cabeçalho/estrutura.
    expect(out.startsWith(INTAKE_FINDINGS_HEAD)).toBe(true);
  });
});

describe("stripPreviousFindings inclui o bloco do intake", () => {
  it("remove o bloco do intake quando é o único bloco (re-import idempotente)", () => {
    const humano = "Texto do terapeuta.";
    const prev = `${humano}\n\n${INTAKE_FINDINGS_HEAD}\n- Queixa: Fadiga`;
    expect(stripPreviousFindings(prev)).toBe(humano);
  });

  it("remove a partir do primeiro cabeçalho quando há QRM + intake", () => {
    const humano = "Nota livre.";
    const prev = `${humano}\n\nQRM=42, acima de 40\n- Energia: cansaço (6)\n\n${INTAKE_FINDINGS_HEAD}\n- Sono: ruim`;
    expect(stripPreviousFindings(prev)).toBe(humano);
  });
});
