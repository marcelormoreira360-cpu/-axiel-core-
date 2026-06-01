"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("portal.packages");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMembership = offer.offer_type === "membership";

  async function handlePurchase() {
    setLoading(true);
    setError(null);

    const endpoint = isMembership
      ? "/api/stripe/patient-subscription"
      : "/api/stripe/patient-checkout";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: offer.id, portal_token: rawToken }),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? t("errStart"));
      }

      const { url } = (await res.json()) as { url: string };
      if (url) {
        window.location.href = url;
      } else {
        throw new Error(t("errNoUrl"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errStart"));
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
        {loading ? t("redirecting") : isMembership ? t("subscribe") : t("buy")}
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
  const t = useTranslations("portal.packages");
  if (offers.length === 0) return null;

  const hasMembership = offers.some((o) => o.offer_type === "membership");
  const hasNonMembership = offers.some((o) => o.offer_type !== "membership");
  const sectionTitle = hasMembership && hasNonMembership
    ? t("titleBoth")
    : offers.every((o) => o.offer_type === "membership")
    ? t("titlePlans")
    : t("titlePackages");

  return (
    <div className="bg-white rounded-2xl border border-black/[.07] p-5 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40">
        {sectionTitle}
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
                    {t("sessions", { count: offer.number_of_sessions })}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-base font-bold text-[#0F1A2E]">
                  {formatCurrency(offer.price_cents, offer.currency || "BRL")}
                </p>
                {offer.offer_type === "membership" && (
                  <p className="text-[10px] text-black/35">{t("perMonth")}</p>
                )}
              </div>
            </div>
            <PurchaseButton offer={offer} rawToken={rawToken} />
          </div>
        ))}
      </div>
    </div>
  );
}
