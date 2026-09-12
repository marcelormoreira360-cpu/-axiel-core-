import { describe, it, expect } from "vitest";
import {
  computePaymentBadge,
  resolveCategoryColor,
  pickPackageBadge,
  DEFAULT_CATEGORY_COLOR,
  type PaymentLike,
} from "@/modules/schedule/appointment-visuals";

const paid = (amount: number): PaymentLike => ({ status: "paid", amount_cents: amount, refund_amount_cents: null });
const partiallyRefunded = (amount: number, refund: number): PaymentLike => ({
  status: "partially_refunded", amount_cents: amount, refund_amount_cents: refund,
});
const refunded = (amount: number): PaymentLike => ({ status: "refunded", amount_cents: amount, refund_amount_cents: amount });
const failed = (amount: number): PaymentLike => ({ status: "failed", amount_cents: amount, refund_amount_cents: null });

describe("resolveCategoryColor", () => {
  it("prioriza o override do tipo", () => {
    expect(resolveCategoryColor("#111111", "#222222")).toBe("#111111");
  });
  it("usa a cor da categoria quando não há override", () => {
    expect(resolveCategoryColor(null, "#222222")).toBe("#222222");
  });
  it("cai no cinza default quando não há cor alguma", () => {
    expect(resolveCategoryColor(null, null)).toBe(DEFAULT_CATEGORY_COLOR);
    expect(resolveCategoryColor("  ", "")).toBe(DEFAULT_CATEGORY_COLOR);
  });
});

describe("computePaymentBadge", () => {
  it("esconde o selo quando não há valor devido", () => {
    expect(computePaymentBadge({ dueCents: 0, coveredByPackage: false, payments: [] })).toBeNull();
  });

  it("esconde o selo quando a sessão é coberta por pacote", () => {
    expect(
      computePaymentBadge({ dueCents: 15000, coveredByPackage: true, payments: [] }),
    ).toBeNull();
  });

  it("marca Pendente quando nada foi pago", () => {
    expect(
      computePaymentBadge({ dueCents: 15000, coveredByPackage: false, payments: [] }),
    ).toBe("pending");
  });

  it("pagamento que falhou não conta como pago (Pendente)", () => {
    expect(
      computePaymentBadge({ dueCents: 15000, coveredByPackage: false, payments: [failed(15000)] }),
    ).toBe("pending");
  });

  it("marca Pago quando o líquido cobre o devido", () => {
    expect(
      computePaymentBadge({ dueCents: 15000, coveredByPackage: false, payments: [paid(15000)] }),
    ).toBe("paid");
  });

  it("marca Pago com soma de vários pagamentos", () => {
    expect(
      computePaymentBadge({ dueCents: 15000, coveredByPackage: false, payments: [paid(10000), paid(5000)] }),
    ).toBe("paid");
  });

  it("marca Parcial quando pagou menos que o devido", () => {
    expect(
      computePaymentBadge({ dueCents: 15000, coveredByPackage: false, payments: [paid(5000)] }),
    ).toBe("partial");
  });

  it("marca Reembolsado quando houve reembolso total", () => {
    expect(
      computePaymentBadge({ dueCents: 15000, coveredByPackage: false, payments: [refunded(15000)] }),
    ).toBe("refunded");
  });

  it("reembolso parcial que derruba abaixo do devido vira Reembolsado", () => {
    // pagou 15000, reembolsou 10000 -> líquido 5000 < 15000 e houve refund
    expect(
      computePaymentBadge({
        dueCents: 15000,
        coveredByPackage: false,
        payments: [partiallyRefunded(15000, 10000)],
      }),
    ).toBe("refunded");
  });

  it("reembolso parcial que ainda cobre o devido continua Pago", () => {
    // pagou 20000, reembolsou 2000 -> líquido 18000 >= 15000
    expect(
      computePaymentBadge({
        dueCents: 15000,
        coveredByPackage: false,
        payments: [partiallyRefunded(20000, 2000)],
      }),
    ).toBe("paid");
  });
});

describe("pickPackageBadge", () => {
  it("lista vazia devolve null", () => {
    expect(pickPackageBadge([])).toBeNull();
  });

  it("mostra usadas/total e não sinaliza renovar longe do fim", () => {
    expect(pickPackageBadge([{ sessions_used: 1, sessions_total: 4, start_date: "2026-01-01" }])).toEqual({
      used: 1,
      total: 4,
      renew: false,
    });
  });

  it("sinaliza renovar na última sessão (resta 1) e no esgotado", () => {
    expect(pickPackageBadge([{ sessions_used: 3, sessions_total: 4, start_date: "2026-01-01" }])?.renew).toBe(true);
    expect(pickPackageBadge([{ sessions_used: 4, sessions_total: 4, start_date: "2026-01-01" }])).toEqual({
      used: 4,
      total: 4,
      renew: true,
    });
  });

  it("prefere o pacote com sessão sobrando (mais antigo primeiro)", () => {
    const badge = pickPackageBadge([
      { sessions_used: 4, sessions_total: 4, start_date: "2026-01-01" }, // esgotado
      { sessions_used: 1, sessions_total: 5, start_date: "2026-03-01" }, // com sobra
    ]);
    expect(badge).toEqual({ used: 1, total: 5, renew: false });
  });
});
