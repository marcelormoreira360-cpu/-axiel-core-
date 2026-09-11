import { describe, it, expect } from "vitest";
import {
  normalizeForSearch,
  tokenizeQuery,
  relevanceScore,
  rankByRelevance,
} from "@/lib/search-ranking";

describe("normalizeForSearch", () => {
  it("minúsculas e sem acento", () => {
    expect(normalizeForSearch("José")).toBe("jose");
    expect(normalizeForSearch("PEDRO Vítor")).toBe("pedro vitor");
    expect(normalizeForSearch(null)).toBe("");
  });
});

describe("tokenizeQuery", () => {
  it("divide por espaço e remove pontuação que quebra o PostgREST", () => {
    expect(tokenizeQuery("Pedro Vitor")).toEqual(["Pedro", "Vitor"]);
    expect(tokenizeQuery("  Pedro,  (Vitor) ")).toEqual(["Pedro", "Vitor"]);
  });
  it("limita a 6 tokens", () => {
    expect(tokenizeQuery("a b c d e f g h")).toHaveLength(6);
  });
});

describe("relevanceScore", () => {
  const name = "Pedro Vitor Saldanha de Moraes";
  it("prefixo da query inteira = 1", () => {
    expect(relevanceScore(name, "pedro v", tokenizeQuery("pedro v"))).toBe(1);
  });
  it("palavras em qualquer ordem (prefixo de cada) = 2", () => {
    expect(relevanceScore(name, "vitor pedro", tokenizeQuery("vitor pedro"))).toBe(2);
    expect(relevanceScore(name, "pedro saldanha", tokenizeQuery("pedro saldanha"))).toBe(2);
  });
  it("ignora acento e caixa", () => {
    expect(relevanceScore("José Antônio", "jose", tokenizeQuery("jose"))).toBe(1);
  });
  it("nome idêntico = 0", () => {
    expect(relevanceScore(name, name, tokenizeQuery(name))).toBe(0);
  });
});

describe("rankByRelevance", () => {
  const pedros = [
    { id: "1", full_name: "Pedro Guelles ( Mae Priscila )" },
    { id: "2", full_name: "Pedro Henrique Laurenio Gomes" },
    { id: "3", full_name: "Pedro Henrique Moreira Lage" },
    { id: "4", full_name: "Pedro Luppi Tel" },
    { id: "5", full_name: "Pedro Tonon Dourado" },
    { id: "6", full_name: "Pedro Vitor Saldanha de Moraes" },
  ];
  const byName = (p: { full_name: string }) => p.full_name;

  it("'pedro v' traz o Pedro Vitor em primeiro", () => {
    const out = rankByRelevance(pedros, "pedro v", byName, 8);
    expect(out[0].id).toBe("6");
  });

  it("'vitor' (só o meio do nome) encontra o Pedro Vitor", () => {
    const out = rankByRelevance(pedros, "vitor", byName, 8);
    expect(out.map((p) => p.id)).toContain("6");
  });

  it("respeita o limite", () => {
    const out = rankByRelevance(pedros, "pedro", byName, 3);
    expect(out).toHaveLength(3);
  });
});
