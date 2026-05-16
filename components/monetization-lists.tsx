import { BadgeDollarSign, PackagePlus } from "lucide-react";
import type { MonetizationOffer, PatientOffer } from "@/lib/types";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { LimitedList } from "@/components/limited-list";
import { formatPrice, getPatientOfferProgress, OFFER_TYPE_LABELS } from "@/modules/monetization/pricing";

export function OfferList({
  offers,
  toggleAction,
}: {
  offers: MonetizationOffer[];
  toggleAction: (formData: FormData) => Promise<void>;
}) {
  if (offers.length === 0) {
    return (
      <EmptyState
        icon={<PackagePlus className="h-7 w-7" />}
        title="No packages or memberships yet"
        text="Create your first offer so the clinic can sell sessions or memberships clearly."
        href="/monetization"
        action="Create first offer"
      />
    );
  }

  return (
    <LimitedList
      items={offers}
      className="grid gap-3 md:grid-cols-2"
      detailsLabel={`View ${Math.max(offers.length - 5, 0)} more offers`}
      renderItem={(offer) => (
        <Card key={offer.id} className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/35">{OFFER_TYPE_LABELS[offer.offer_type]}</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight">{offer.name}</h3>
              <p className="mt-2 text-sm leading-5 text-black/50">{offer.description || "Flexible clinic-defined offer."}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${offer.is_active ? "bg-emerald-50 text-emerald-700" : "bg-black/5 text-black/45"}`}>
              {offer.is_active ? "Active" : "Paused"}
            </span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-axiel-soft p-4">
              <p className="text-xs text-black/40">Price</p>
              <p className="mt-1 text-xl font-semibold">{formatPrice(offer.price_cents, offer.currency)}</p>
            </div>
            <div className="rounded-2xl bg-axiel-soft p-4">
              <p className="text-xs text-black/40">Sessions</p>
              <p className="mt-1 text-xl font-semibold">{offer.number_of_sessions}</p>
            </div>
          </div>
          <form action={toggleAction} className="mt-4">
            <input type="hidden" name="id" value={offer.id} />
            <input type="hidden" name="is_active" value={String(!offer.is_active)} />
            <Button variant="secondary" className="w-full">{offer.is_active ? "Pause" : "Reactivate"}</Button>
          </form>
        </Card>
      )}
    />
  );
}

export function PatientOfferList({ patientOffers }: { patientOffers: PatientOffer[] }) {
  if (patientOffers.length === 0) {
    return (
      <EmptyState
        icon={<BadgeDollarSign className="h-7 w-7" />}
        title="No patient plans assigned"
        text="Assign a package or membership after creating an offer and adding a patient."
        href="/patients/new"
        action="Add patient"
      />
    );
  }

  return (
    <LimitedList
      items={patientOffers}
      className="space-y-3"
      detailsLabel={`View ${Math.max(patientOffers.length - 5, 0)} more assigned plans`}
      renderItem={(item) => {
        const progress = getPatientOfferProgress(item);
        return (
          <Card key={item.id} className="p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/35">{item.patients?.full_name ?? "Patient"}</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight">{item.monetization_offers?.name ?? "Assigned offer"}</h3>
                <p className="mt-1 text-sm text-black/45">{progress.remaining} sessions remaining • {item.status}</p>
              </div>
              <div className="min-w-44 rounded-2xl bg-axiel-soft p-4">
                <p className="text-xs text-black/40">Used</p>
                <p className="mt-1 text-2xl font-semibold">{item.sessions_used}/{item.sessions_total}</p>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/5">
              <div className="h-full rounded-full bg-axiel-ink" style={{ width: `${progress.percentage}%` }} />
            </div>
          </Card>
        );
      }}
    />
  );
}
