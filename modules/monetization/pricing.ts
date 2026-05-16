import type { MonetizationOffer, MonetizationOfferType, PatientOffer } from "@/lib/types";

export const OFFER_TYPE_LABELS: Record<MonetizationOfferType, string> = {
  session_package: "Session package",
  membership: "Membership",
};

export function formatPrice(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function getOfferSubtitle(offer: Pick<MonetizationOffer, "offer_type" | "number_of_sessions" | "price_cents" | "currency">) {
  return `${OFFER_TYPE_LABELS[offer.offer_type]} • ${offer.number_of_sessions} sessions • ${formatPrice(offer.price_cents, offer.currency)}`;
}

export function getPatientOfferProgress(offer: Pick<PatientOffer, "sessions_total" | "sessions_used">) {
  const remaining = Math.max(offer.sessions_total - offer.sessions_used, 0);
  const percentage = offer.sessions_total === 0 ? 0 : Math.round((offer.sessions_used / offer.sessions_total) * 100);
  return { remaining, percentage };
}
