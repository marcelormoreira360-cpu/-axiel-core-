import { describe, it, expect } from "vitest";
import { normalizeName, namesMatch } from "@/lib/name-match";

describe("normalizeName", () => {
  it("remove acentos, pontuação e colapsa espaços", () => {
    expect(normalizeName("João  Café-Silva")).toBe("joao cafe silva");
    expect(normalizeName("  MARIA   Antônia  ")).toBe("maria antonia");
    expect(normalizeName(null)).toBe("");
    expect(normalizeName("")).toBe("");
  });
});

describe("namesMatch — mesma pessoa (deve fundir)", () => {
  it("nome curto contido no completo", () => {
    expect(namesMatch("Rafael Castelo", "Rafael Castelo Branco de Andrade")).toBe(true);
  });
  it("mesmo nome com caixa/acento diferente", () => {
    expect(namesMatch("RAFAEL CASTELO BRANCO DE ANDRADE", "Rafael Castelo Branco de Andrade")).toBe(true);
    expect(namesMatch("João Silva", "Joao Silva")).toBe(true);
  });
  it("ordem de sobrenomes trocada mantendo primeiro nome + um sobrenome", () => {
    expect(namesMatch("Marina Fumagalli Graveli", "Marina Gravelle Fumagalli")).toBe(true);
  });
  it("typo em um sobrenome mas primeiro nome + outro sobrenome batem", () => {
    expect(namesMatch("Bruna Castanha Suzuki", "Bruna Castanha Susuki")).toBe(true);
  });
});

describe("namesMatch — pessoas DIFERENTES (não pode fundir)", () => {
  it("parentes com mesmo sobrenome mas primeiro nome diferente (caso telefone compartilhado)", () => {
    expect(namesMatch("Pedro Valpereira", "Fabio Valpereira")).toBe(false);
    expect(namesMatch("Angelo Celestino", "Roseli Celestino")).toBe(false);
  });
  it("só primeiro nome não basta (evita fundir homônimos)", () => {
    expect(namesMatch("Maria", "Maria Silva")).toBe(false);
    expect(namesMatch("Ana", "Ana Paula Souza")).toBe(false);
  });
  it("vazio de um dos lados nunca casa", () => {
    expect(namesMatch("", "Rafael Castelo")).toBe(false);
    expect(namesMatch("Rafael Castelo", null)).toBe(false);
    expect(namesMatch(null, undefined)).toBe(false);
  });
  it("mesmo sobrenome só, sem primeiro nome em comum", () => {
    expect(namesMatch("Carlos Souza", "Marcos Souza")).toBe(false);
  });
});

describe("namesMatch — nome idêntico de token único", () => {
  it("igualdade exata de nome único casa (raro, mas determinístico)", () => {
    expect(namesMatch("Madonna", "Madonna")).toBe(true);
  });
});
