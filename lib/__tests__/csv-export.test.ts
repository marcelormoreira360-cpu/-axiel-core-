import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/csv-export";

describe("toCsv", () => {
  it("monta cabeçalho + linhas com delimitador ';' e BOM", () => {
    const csv = toCsv(["A", "B"], [["1", "2"], ["3", "4"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM
    const body = csv.slice(1);
    expect(body).toBe("A;B\r\n1;2\r\n3;4");
  });

  it("escapa campos com ';', aspas ou quebra de linha", () => {
    const csv = toCsv(["X"], [['a;b'], ['diz "oi"'], ["linha1\nlinha2"]]);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[1]).toBe('"a;b"');
    expect(lines[2]).toBe('"diz ""oi"""');
    expect(lines[3]).toBe('"linha1\nlinha2"');
  });

  it("trata null/undefined como vazio", () => {
    const csv = toCsv(["X", "Y"], [[null, undefined]]);
    expect(csv.slice(1)).toBe("X;Y\r\n;");
  });
});
