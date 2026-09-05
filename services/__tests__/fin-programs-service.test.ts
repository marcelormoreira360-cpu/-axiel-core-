import { describe, it, expect } from "vitest";
import { computeProgramTotals } from "@/services/fin-programs-service";

describe("computeProgramTotals", () => {
  it("agrupa por nome, calcula utilização e passivo, e casa preço do catálogo", () => {
    const price = new Map<string, number>([["reset", 20000]]); // R$200/sessão
    const { rows, totals } = computeProgramTotals(
      [
        { name: "Reset", sessions_total: 10, sessions_used: 4 }, // pendente 6
        { name: "Reset", sessions_total: 5, sessions_used: 5 },  // pendente 0
        { name: "Detox", sessions_total: 8, sessions_used: 2 },  // pendente 6, sem preço
      ],
      price,
    );

    const reset = rows.find((r) => r.name === "Reset")!;
    expect(reset.packages).toBe(2);
    expect(reset.soldSessions).toBe(15);
    expect(reset.usedSessions).toBe(9);
    expect(reset.pendingSessions).toBe(6);
    expect(reset.utilizationPct).toBe(60); // 9/15
    expect(reset.pendingValueCents).toBe(120000); // 6 × 20000

    const detox = rows.find((r) => r.name === "Detox")!;
    expect(detox.pendingValueCents).toBeNull(); // sem preço de catálogo

    expect(totals.activePackages).toBe(3);
    expect(totals.soldSessions).toBe(23);
    expect(totals.pendingSessions).toBe(12);
    expect(totals.pendingValueCents).toBe(120000); // só o que tem preço
    // ordena por pendentes desc: Reset(6) e Detox(6) empatam — ambos no topo
    expect(rows[0].pendingSessions).toBe(6);
  });

  it("grampeia used <= total e não divide por zero", () => {
    const { rows, totals } = computeProgramTotals(
      [{ name: "X", sessions_total: 4, sessions_used: 99 }],
      new Map(),
    );
    expect(rows[0].usedSessions).toBe(4);
    expect(rows[0].pendingSessions).toBe(0);
    expect(rows[0].utilizationPct).toBe(100);
    expect(totals.utilizationPct).toBe(100);
  });

  it("sem pacotes = zeros", () => {
    const { rows, totals } = computeProgramTotals([], new Map());
    expect(rows).toEqual([]);
    expect(totals.activePackages).toBe(0);
    expect(totals.utilizationPct).toBe(0);
  });
});
