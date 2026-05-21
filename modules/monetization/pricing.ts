import type { MonetizationOffer, MonetizationOfferType, PatientOffer } from "@/lib/types";

export const OFFER_TYPE_LABELS: Record<MonetizationOfferType, string> = {
  session_package: "Pacote de sessões",
  membership: "Assinatura",
};

export function formatPrice(cents: number, currency = "BRL") {
  const locale = currency === "BRL" ? "pt-BR" : "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

export function getOfferSubtitle(offer: Pick<MonetizationOffer, "offer_type" | "number_of_sessions" | "price_cents" | "currency">) {
  return `${OFFER_TYPE_LABELS[offer.offer_type]} · ${offer.number_of_sessions} sessões · ${formatPrice(offer.price_cents, offer.currency)}`;
}

export function getPatientOfferProgress(offer: Pick<PatientOffer, "sessions_total" | "sessions_used">) {
  const remaining = Math.max(offer.sessions_total - offer.sessions_used, 0);
  const percentage = offer.sessions_total === 0 ? 0 : Math.round((offer.sessions_used / offer.sessions_total) * 100);
  return { remaining, percentage };
}
