import { describe, it, expect } from "vitest";
import { computeSuggestedFee, type ClinicFeeConfig } from "@/services/fee-decision-service";

// Testa a lógica PURA do valor sugerido de taxa (sem tocar no banco):
// percentual com clamp piso/teto, modo fixo, modo none, cortesia de 1ª falta e
// fallback quando a sessão não tem preço. Nenhum valor é constante no código: tudo
// vem da config da clínica (seed do Cobro, sobrescrevível).

// Config seed do Cobro (defaults da migration 142).
const SEED: ClinicFeeConfig = {
  no_show_fee_mode: "percent",
  no_show_fee_percent: 50,
  no_show_fee_min_cents: 5000,
  no_show_fee_max_cents: 15000,
  late_cancel_fee_mode: "percent",
  late_cancel_fee_percent: 25,
  late_cancel_fee_min_cents: 2500,
  late_cancel_fee_max_cents: 7500,
  first_miss_courtesy: true,
};

describe("computeSuggestedFee — percentual com piso/teto", () => {
  it("no-show 50% de US$150 = US$75 (dentro da faixa)", () => {
    const r = computeSuggestedFee({
      triggerStatus: "no_show",
      config: SEED,
      sessionPriceCents: 15000,
      isFirstOccurrence: false,
    });
    expect(r).toEqual({ amountCents: 7500, reason: "percent" });
  });

  it("no-show 50% de US$300 estoura o teto → US$150", () => {
    const r = computeSuggestedFee({
      triggerStatus: "no_show",
      config: SEED,
      sessionPriceCents: 30000,
      isFirstOccurrence: false,
    });
    expect(r).toEqual({ amountCents: 15000, reason: "percent" });
  });

  it("no-show 50% de US$60 abaixo do piso → US$50", () => {
    const r = computeSuggestedFee({
      triggerStatus: "no_show",
      config: SEED,
      sessionPriceCents: 6000, // 50% = 3000, abaixo do piso 5000
      isFirstOccurrence: false,
    });
    expect(r).toEqual({ amountCents: 5000, reason: "percent" });
  });

  it("late_cancel cobra menos que no_show (25% de US$200 = US$50)", () => {
    const r = computeSuggestedFee({
      triggerStatus: "late_cancel",
      config: SEED,
      sessionPriceCents: 20000,
      isFirstOccurrence: false,
    });
    expect(r).toEqual({ amountCents: 5000, reason: "percent" });
  });
});

describe("computeSuggestedFee — cortesia, none, fixo, fallback", () => {
  it("1ª ocorrência com cortesia ligada → 0", () => {
    const r = computeSuggestedFee({
      triggerStatus: "no_show",
      config: SEED,
      sessionPriceCents: 30000,
      isFirstOccurrence: true,
    });
    expect(r).toEqual({ amountCents: 0, reason: "courtesy" });
  });

  it("cortesia desligada aplica a regra normal já na 1ª", () => {
    const r = computeSuggestedFee({
      triggerStatus: "no_show",
      config: { ...SEED, first_miss_courtesy: false },
      sessionPriceCents: 15000,
      isFirstOccurrence: true,
    });
    expect(r).toEqual({ amountCents: 7500, reason: "percent" });
  });

  it("mode='none' desliga a cobrança → 0 mesmo na reincidência", () => {
    const r = computeSuggestedFee({
      triggerStatus: "no_show",
      config: { ...SEED, no_show_fee_mode: "none" },
      sessionPriceCents: 30000,
      isFirstOccurrence: false,
    });
    expect(r).toEqual({ amountCents: 0, reason: "none" });
  });

  it("mode='fixed' usa o valor fixo (min_cents), ignora o preço", () => {
    const r = computeSuggestedFee({
      triggerStatus: "no_show",
      config: { ...SEED, no_show_fee_mode: "fixed", no_show_fee_min_cents: 7500 },
      sessionPriceCents: 30000,
      isFirstOccurrence: false,
    });
    expect(r).toEqual({ amountCents: 7500, reason: "fixed" });
  });

  it("percent sem preço da sessão cai no piso (fallback)", () => {
    const r = computeSuggestedFee({
      triggerStatus: "no_show",
      config: SEED,
      sessionPriceCents: null,
      isFirstOccurrence: false,
    });
    expect(r).toEqual({ amountCents: 5000, reason: "percent_fallback" });
  });

  it("percent com preço 0 também cai no fallback", () => {
    const r = computeSuggestedFee({
      triggerStatus: "no_show",
      config: SEED,
      sessionPriceCents: 0,
      isFirstOccurrence: false,
    });
    expect(r).toEqual({ amountCents: 5000, reason: "percent_fallback" });
  });

  it("none tem prioridade sobre a cortesia (0 por 'none', não por 'courtesy')", () => {
    const r = computeSuggestedFee({
      triggerStatus: "late_cancel",
      config: { ...SEED, late_cancel_fee_mode: "none" },
      sessionPriceCents: 20000,
      isFirstOccurrence: true,
    });
    expect(r).toEqual({ amountCents: 0, reason: "none" });
  });

  it("piso/teto null não travam o percentual", () => {
    const r = computeSuggestedFee({
      triggerStatus: "no_show",
      config: { ...SEED, no_show_fee_min_cents: null, no_show_fee_max_cents: null },
      sessionPriceCents: 10000, // 50% = 5000, sem clamp
      isFirstOccurrence: false,
    });
    expect(r).toEqual({ amountCents: 5000, reason: "percent" });
  });
});
