import { describe, it, expect } from "vitest";
import { computeSaasSummary, monthlyAmountCents, computeAttachRate } from "@/services/fin-saas-service";

describe("monthlyAmountCents", () => {
  it("mantém o valor mensal e normaliza o anual ÷ 12", () => {
    expect(monthlyAmountCents(10000, "monthly")).toBe(10000);
    expect(monthlyAmountCents(120000, "yearly")).toBe(10000);
  });
});

describe("computeSaasSummary", () => {
  it("MRR soma active + past_due, normaliza anual, e ARR = MRR × 12", () => {
    const r = computeSaasSummary([
      { amount_cents: 20000, billing_interval: "monthly", status: "active", plan_name: "Reset Mensal" },
      { amount_cents: 240000, billing_interval: "yearly", status: "active", plan_name: "Reset Anual" }, // 20000/mês
      { amount_cents: 10000, billing_interval: "monthly", status: "past_due", plan_name: "Reset Mensal" },
      { amount_cents: 15000, billing_interval: "monthly", status: "trialing", plan_name: "Reset Mensal" }, // fora do MRR
      { amount_cents: 50000, billing_interval: "monthly", status: "canceled", plan_name: "Reset Mensal" }, // fora
    ]);
    expect(r.mrrCents).toBe(50000); // 20000 + 20000 + 10000
    expect(r.arrCents).toBe(600000);
    expect(r.activeCount).toBe(3); // 2 active + 1 past_due
    expect(r.trialingCount).toBe(1);
    expect(r.pastDueCount).toBe(1);
    // por plano: Reset Mensal = 20000+10000=30000 (2 assinantes), Reset Anual = 20000 (1)
    expect(r.byPlan[0]).toEqual({ plan: "Reset Mensal", subscribers: 2, mrrCents: 30000 });
    expect(r.byPlan.find((p) => p.plan === "Reset Anual")).toEqual({ plan: "Reset Anual", subscribers: 1, mrrCents: 20000 });
  });

  it("sem assinaturas geradoras de receita = zero", () => {
    const r = computeSaasSummary([{ amount_cents: 9900, billing_interval: "monthly", status: "trialing", plan_name: "X" }]);
    expect(r.mrrCents).toBe(0);
    expect(r.activeCount).toBe(0);
    expect(r.trialingCount).toBe(1);
    expect(r.byPlan).toEqual([]);
  });
});

describe("computeAttachRate", () => {
  it("razão pacientes-com-recomendação ÷ pacientes-com-exame em %", () => {
    expect(computeAttachRate(3, 4)).toBe(75);
    expect(computeAttachRate(1, 3)).toBe(33.3);
  });
  it("sem exames não divide por zero", () => {
    expect(computeAttachRate(0, 0)).toBe(0);
  });
});
