import { describe, it, expect } from "vitest";
import { computeExecutiveTotals } from "@/services/fin-ledger-service";

describe("computeExecutiveTotals", () => {
  const kpis = { revenueThisMonth: 100000, revenueLastMonth: 80000, pendingEstimatedCents: 30000 };

  it("soma receita manual à receita de pagamentos e subtrai despesas", () => {
    const r = computeExecutiveTotals(
      kpis,
      [
        { kind: "revenue", amount_cents: 20000 },
        { kind: "expense", amount_cents: 50000 },
        { kind: "expense", amount_cents: 10000 },
      ],
      "BRL",
    );
    expect(r.revenueCents).toBe(120000); // 100000 (pagamentos) + 20000 (manual)
    expect(r.expenseCents).toBe(60000); // 50000 + 10000
    expect(r.netCents).toBe(60000); // 120000 - 60000
    expect(r.receivableCents).toBe(30000);
    expect(r.revenuePrevCents).toBe(80000);
    expect(r.fromExistingRevenueCents).toBe(100000);
    expect(r.currency).toBe("BRL");
  });

  it("resultado negativo quando despesa > receita", () => {
    const r = computeExecutiveTotals(
      { revenueThisMonth: 0, revenueLastMonth: 0, pendingEstimatedCents: 0 },
      [{ kind: "expense", amount_cents: 25000 }],
      "USD",
    );
    expect(r.netCents).toBe(-25000);
  });

  it("sem lançamentos manuais = só a receita dos pagamentos", () => {
    const r = computeExecutiveTotals(kpis, [], "BRL");
    expect(r.revenueCents).toBe(100000);
    expect(r.expenseCents).toBe(0);
    expect(r.netCents).toBe(100000);
  });
});
