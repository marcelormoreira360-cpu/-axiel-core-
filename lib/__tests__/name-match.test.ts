import { describe, it, expect } from "vitest";
import { normalizeName, namesMatch } from "@/lib/name-match";

describe("normalizeName", () => {
  it("remove acentos, pontuação e colapsa espaços", () => {
    expect(normalizeName("João  Café-Silva")).toBe("joao cafe silva");
    expect(normalizeName("  MARIA   Antônia  ")).toBe("maria antonia");
    expect(normalizeName(null)).toBe("");
    expect(normalizeName("")).toBe("");
  });
  it("nomes não-latinos viram vazio (dedup desligado, finding #6)", () => {
    expect(normalizeName("Иван Петров")).toBe("");
    expect(normalizeName("山田太郎")).toBe("");
  });
});

describe("namesMatch — mesma pessoa (deve fundir)", () => {
  it("mesmo nome com caixa/acento diferente", () => {
    expect(namesMatch("RAFAEL CASTELO BRANCO DE ANDRADE", "Rafael Castelo Branco de Andrade")).toBe(true);
    expect(namesMatch("João Silva", "Joao Silva")).toBe(true);
  });
  it("nome idêntico casa", () => {
    expect(namesMatch("João Silva", "João Silva")).toBe(true);
  });
  it("mesma pessoa com ordem dos tokens trocada (conjunto idêntico)", () => {
    expect(namesMatch("Marina Fumagalli Graveli", "Marina Graveli Fumagalli")).toBe(true);
  });
});

describe("namesMatch — pessoas DIFERENTES (não pode fundir)", () => {
  it("parentes com mesmo sobrenome mas primeiro nome diferente (caso telefone compartilhado)", () => {
    expect(namesMatch("Pedro Valpereira", "Fabio Valpereira")).toBe(false);
    expect(namesMatch("Angelo Celestino", "Roseli Celestino")).toBe(false);
  });
  it("parentes com mesmo primeiro nome + um sobrenome, mas nome do meio diferente", () => {
    // caso central do finding #1: casamento frouxo antigo fundia estes por engano.
    expect(namesMatch("Ana Paula Souza", "Ana Beatriz Souza")).toBe(false);
  });
  it("nome curto contido no completo NÃO funde (token a mais/menos)", () => {
    expect(namesMatch("Rafael Castelo", "Rafael Castelo Branco de Andrade")).toBe(false);
    expect(namesMatch("João P Silva", "João Silva")).toBe(false);
  });
  it("typo em um sobrenome NÃO funde (token diferente)", () => {
    expect(namesMatch("Bruna Castanha Suzuki", "Bruna Castanha Susuki")).toBe(false);
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
