import { describe, it, expect } from "vitest";
import { computeMonthlyClose } from "@/services/fin-monthly-close-service";

describe("computeMonthlyClose", () => {
  it("receita = pagamentos + receita manual; despesa = razão + repasse; resultado = receita − despesa", () => {
    const r = computeMonthlyClose(100000, 20000, 30000, 15000);
    expect(r.revenueCents).toBe(120000); // 100000 + 20000
    expect(r.expenseCents).toBe(45000); // 30000 + 15000
    expect(r.netCents).toBe(75000); // 120000 - 45000
  });

  it("resultado negativo quando despesa supera receita", () => {
    const r = computeMonthlyClose(0, 0, 40000, 10000);
    expect(r.revenueCents).toBe(0);
    expect(r.expenseCents).toBe(50000);
    expect(r.netCents).toBe(-50000);
  });

  it("mês zerado", () => {
    expect(computeMonthlyClose(0, 0, 0, 0)).toEqual({ revenueCents: 0, expenseCents: 0, netCents: 0 });
  });
});
