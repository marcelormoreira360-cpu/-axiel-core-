"use client";

import { useState } from "react";
import type { PatientPortalOffer } from "@/services/patient-portal-service";

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase() || "BRL",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

type PurchaseButtonProps = {
  offer: PatientPortalOffer;
  rawToken: string;
};

function PurchaseButton({ offer, rawToken }: PurchaseButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePurchase() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/patient-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: offer.id, portal_token: rawToken }),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Erro ao iniciar pagamento.");
      }

      const { url } = (await res.json()) as { url: string };
      if (url) {
        window.location.href = url;
      } else {
        throw new Error("URL de pagamento não retornada.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar pagamento.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handlePurchase}
        disabled={loading}
        className="w-full rounded-xl bg-[#0F6E56] py-2.5 text-sm font-semibold text-white transition hover:bg-[#0a5b47] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? "Redirecionando…" : "Comprar"}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-500 text-center">{error}</p>
      )}
    </div>
  );
}

type PackagesSectionProps = {
  offers: PatientPortalOffer[];
  rawToken: string;
};

export function PackagesSection({ offers, rawToken }: PackagesSectionProps) {
  if (offers.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-black/[.07] p-5 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40">
        Pacotes disponíveis
      </p>
      <div className="space-y-3">
        {offers.map((offer) => (
          <div
            key={offer.id}
            className="rounded-xl border border-black/[.07] bg-[#F8FAF9] p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#0F1A2E] leading-snug">{offer.name}</p>
                {offer.description && (
                  <p className="mt-0.5 text-xs text-black/50 leading-relaxed">{offer.description}</p>
                )}
                {offer.number_of_sessions && (
                  <p className="mt-1 text-xs text-black/40">
                    {offer.number_of_sessions} sessão{offer.number_of_sessions > 1 ? "ões" : ""}
                  </p>
                )}
              </div>
              <p className="shrink-0 text-base font-bold text-[#0F1A2E]">
                {formatCurrency(offer.price_cents, offer.currency || "BRL")}
              </p>
            </div>
            <PurchaseButton offer={offer} rawToken={rawToken} />
          </div>
        ))}
      </div>
    </div>
  );
}
