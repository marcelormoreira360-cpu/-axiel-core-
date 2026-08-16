import { describe, it, expect } from "vitest";
import { isSubscriptionEntitled, effectivePlanSlug } from "../plan-config";

const NOW = new Date("2026-08-16T12:00:00Z");
const FUTURE = "2026-08-30T12:00:00Z";
const PAST = "2026-08-01T12:00:00Z";

describe("isSubscriptionEntitled", () => {
  it("active sempre tem direito", () => {
    expect(isSubscriptionEntitled("active", null, NOW)).toBe(true);
  });
  it("past_due tem direito (tolerância durante dunning)", () => {
    expect(isSubscriptionEntitled("past_due", null, NOW)).toBe(true);
  });
  it("trialing só com trial no futuro", () => {
    expect(isSubscriptionEntitled("trialing", FUTURE, NOW)).toBe(true);
    expect(isSubscriptionEntitled("trialing", PAST, NOW)).toBe(false);
    expect(isSubscriptionEntitled("trialing", null, NOW)).toBe(false);
  });
  it("cancelada / sem assinatura → sem direito", () => {
    expect(isSubscriptionEntitled("canceled", null, NOW)).toBe(false);
    expect(isSubscriptionEntitled("unpaid", null, NOW)).toBe(false);
    expect(isSubscriptionEntitled(null, null, NOW)).toBe(false);
    expect(isSubscriptionEntitled(undefined, undefined, NOW)).toBe(false);
  });
});

describe("effectivePlanSlug", () => {
  it("entrega o plano contratado quando ativo", () => {
    expect(effectivePlanSlug("professional", "active", null, NOW)).toBe("professional");
    expect(effectivePlanSlug("enterprise", "active", null, NOW)).toBe("enterprise");
  });
  it("trial válido mantém o plano; trial vencido cai para starter", () => {
    expect(effectivePlanSlug("professional", "trialing", FUTURE, NOW)).toBe("professional");
    expect(effectivePlanSlug("professional", "trialing", PAST, NOW)).toBe("starter");
  });
  it("cancelada/sem assinatura cai para starter (fecha o vazamento)", () => {
    expect(effectivePlanSlug("professional", "canceled", null, NOW)).toBe("starter");
    expect(effectivePlanSlug("scale", null, null, NOW)).toBe("starter");
  });
  it("slug desconhecido normaliza para starter mesmo com direito", () => {
    expect(effectivePlanSlug("lixo", "active", null, NOW)).toBe("starter");
  });
});
