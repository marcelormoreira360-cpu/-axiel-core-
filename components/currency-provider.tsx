"use client";

import { createContext, useContext, useCallback } from "react";
import { formatMoney } from "@/lib/finance-utils";

type CurrencyCtx = { currency: string; locale: string };

const Ctx = createContext<CurrencyCtx>({ currency: "BRL", locale: "pt-BR" });

export function CurrencyProvider({
  currency,
  locale,
  children,
}: {
  currency: string;
  locale: string;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={{ currency: currency || "BRL", locale: locale || "pt-BR" }}>{children}</Ctx.Provider>;
}

// Retorna um formatador (cents) => string na moeda da clínica.
export function useFormatMoney(): (cents: number) => string {
  const { currency, locale } = useContext(Ctx);
  return useCallback((cents: number) => formatMoney(cents, currency, locale), [currency, locale]);
}

export function useClinicCurrency(): string {
  return useContext(Ctx).currency;
}
