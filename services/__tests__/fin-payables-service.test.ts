import { describe, it, expect } from "vitest";
import { computePayablesSummary, monthlyDueDate } from "@/services/fin-payables-service";

describe("monthlyDueDate", () => {
  it("fixa o dia do mês com zero-padding", () => {
    expect(monthlyDueDate(2026, 9, 5)).toBe("2026-09-05");
    expect(monthlyDueDate(2026, 12, 25)).toBe("2026-12-25");
  });

  it("grampeia no último dia quando o mês é mais curto", () => {
    expect(monthlyDueDate(2026, 2, 31)).toBe("2026-02-28"); // fev não-bissexto
    expect(monthlyDueDate(2028, 2, 31)).toBe("2028-02-29"); // fev bissexto
    expect(monthlyDueDate(2026, 4, 31)).toBe("2026-04-30"); // abril = 30 dias
  });

  it("nunca produz dia menor que 1", () => {
    expect(monthlyDueDate(2026, 6, 0)).toBe("2026-06-01");
  });
});

describe("computePayablesSummary", () => {
  const today = "2026-09-05";

  it("separa vencidas, a vencer no mês e soma o aberto", () => {
    const open = [
      { amount_cents: 10000, due_date: "2026-08-20" }, // vencida
      { amount_cents: 5000, due_date: "2026-09-01" }, // vencida (antes de hoje)
      { amount_cents: 7000, due_date: "2026-09-20" }, // vence este mês
      { amount_cents: 3000, due_date: "2026-10-10" }, // futura, outro mês
    ];
    const r = computePayablesSummary(open, 42000, today, "BRL");
    expect(r.openCents).toBe(25000); // 10000+5000+7000+3000
    expect(r.overdueCents).toBe(15000); // 10000+5000
    expect(r.overdueCount).toBe(2);
    expect(r.dueThisMonthCents).toBe(7000); // só a de 09-20
    expect(r.paidThisMonthCents).toBe(42000);
    expect(r.openCount).toBe(4);
    expect(r.currency).toBe("BRL");
  });

  it("conta vencendo HOJE como a vencer este mês, não como vencida", () => {
    const r = computePayablesSummary([{ amount_cents: 8000, due_date: today }], 0, today, "USD");
    expect(r.overdueCents).toBe(0);
    expect(r.dueThisMonthCents).toBe(8000);
  });

  it("zera tudo sem contas em aberto", () => {
    const r = computePayablesSummary([], 0, today, "BRL");
    expect(r.openCents).toBe(0);
    expect(r.overdueCents).toBe(0);
    expect(r.dueThisMonthCents).toBe(0);
    expect(r.openCount).toBe(0);
  });
});
