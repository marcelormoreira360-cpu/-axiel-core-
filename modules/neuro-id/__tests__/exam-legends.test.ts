import { describe, it, expect } from "vitest";
import { examLegendBlock } from "../exam-legends";

describe("examLegendBlock", () => {
  it("neurometria traz as 6 dimensões e a faixa fixa de temperatura", () => {
    const block = examLegendBlock("neurometria");
    expect(block).toContain("6 dimensões");
    expect(block).toContain("31,5"); // faixa de referência confirmada
    expect(block).toContain("barorreflexo"); // ponto positivo
    expect(block.toLowerCase()).toContain("simpático");
  });

  it("biorressonância nomeia emoções, relaciona a órgãos e abre com a frase canônica", () => {
    const block = examLegendBlock("biorressonancia");
    expect(block).toContain("De acordo com a análise do exame");
    expect(block.toLowerCase()).toContain("coração");
    expect(block.toLowerCase()).toContain("pulmão");
    expect(block.toLowerCase()).toContain("rim");
  });

  it("biorressonância proíbe conteúdo esotérico/holístico (fronteira fé/clínica)", () => {
    const block = examLegendBlock("biorressonancia").toLowerCase();
    expect(block).toContain("chakra"); // citado como PROIBIDO
    expect(block).toContain("excluída");
    expect(block).toContain("não diagnosticar");
  });

  it("tipo desconhecido ('outro' ou vazio) não injeta legenda", () => {
    expect(examLegendBlock("outro")).toBe("");
    expect(examLegendBlock("")).toBe("");
    expect(examLegendBlock("qualquer")).toBe("");
  });
});
