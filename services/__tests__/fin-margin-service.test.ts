import { describe, it, expect } from "vitest";
import { computeMarginTotals } from "@/services/fin-margin-service";

describe("computeMarginTotals", () => {
  it("soma margem de serviços (bruto − repasse) e de produtos (receita − custo)", () => {
    const r = computeMarginTotals(
      [
        { grossCents: 100000, repasseCents: 40000 }, // margem 60000
        { grossCents: 50000, repasseCents: 0 }, // atendimento do dono: margem cheia 50000
      ],
      [
        { revenueCents: 20000, costCents: 8000 }, // margem 12000
        { revenueCents: 10000, costCents: 5000 }, // margem 5000
      ],
    );
    expect(r.servicesGrossCents).toBe(150000);
    expect(r.servicesRepasseCents).toBe(40000);
    expect(r.servicesMarginCents).toBe(110000);
    expect(r.servicesMarginPct).toBe(73.3); // 110000/150000
    expect(r.productsRevenueCents).toBe(30000);
    expect(r.productsCostCents).toBe(13000);
    expect(r.productsMarginCents).toBe(17000);
    expect(r.productsMarginPct).toBe(56.7); // 17000/30000
    expect(r.totalMarginCents).toBe(127000); // 110000 + 17000
  });

  it("não divide por zero quando não há bruto/receita", () => {
    const r = computeMarginTotals([], []);
    expect(r.servicesMarginPct).toBe(0);
    expect(r.productsMarginPct).toBe(0);
    expect(r.totalMarginCents).toBe(0);
  });

  it("margem negativa quando repasse/custo supera a receita", () => {
    const r = computeMarginTotals(
      [{ grossCents: 10000, repasseCents: 12000 }],
      [{ revenueCents: 5000, costCents: 9000 }],
    );
    expect(r.servicesMarginCents).toBe(-2000);
    expect(r.productsMarginCents).toBe(-4000);
    expect(r.totalMarginCents).toBe(-6000);
  });
});
