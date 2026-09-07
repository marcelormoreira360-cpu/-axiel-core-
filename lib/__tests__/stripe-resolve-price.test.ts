import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Testa a regra de moeda de resolveStripePrice: nunca cobrar em moeda diferente
// da pedida. Em especial, pedir USD sem STRIPE_PRICE_<PLANO>_USD deve LANÇAR
// (e não cair em BRL silenciosamente).
//
// As envs são lidas no import do módulo, então setamos ANTES de importar via
// import dinâmico dentro de cada teste (vi.resetModules limpa o cache).

const ENV_KEYS = [
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_STARTER_BRL",
  "STRIPE_PRICE_STARTER_USD",
];

async function loadResolver() {
  // As envs são lidas no topo do módulo; resetModules força reavaliar com as
  // envs atuais no próximo import.
  vi.resetModules();
  const mod = await import("@/lib/stripe");
  return mod.resolveStripePrice;
}

describe("resolveStripePrice — regra de moeda (sem fallback silencioso p/ BRL)", () => {
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) original[k] = process.env[k];
    for (const k of ENV_KEYS) delete process.env[k];
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  });

  it("BRL: resolve pelo Price em BRL (env legada sem sufixo)", async () => {
    process.env.STRIPE_PRICE_STARTER = "price_brl_starter";
    const resolve = await loadResolver();
    const r = resolve("starter", "BRL");
    expect(r.priceId).toBe("price_brl_starter");
    expect(r.currency).toBe("BRL");
    expect(r.requestedCurrency).toBe("BRL");
  });

  it("USD: resolve pelo Price em USD quando setado", async () => {
    process.env.STRIPE_PRICE_STARTER_USD = "price_usd_starter";
    const resolve = await loadResolver();
    const r = resolve("starter", "USD");
    expect(r.priceId).toBe("price_usd_starter");
    expect(r.currency).toBe("USD");
    expect(r.requestedCurrency).toBe("USD");
  });

  it("USD sem Price em USD: LANÇA erro claro, NÃO cai em BRL", async () => {
    // Só o Price BRL existe; pedir USD não pode cobrar em BRL.
    process.env.STRIPE_PRICE_STARTER = "price_brl_starter";
    const resolve = await loadResolver();
    expect(() => resolve("starter", "USD")).toThrowError(/USD/);
  });

  it("BRL sem nenhum Price: LANÇA erro", async () => {
    const resolve = await loadResolver();
    expect(() => resolve("starter", "BRL")).toThrowError(/Missing Stripe price ID/);
  });
});
