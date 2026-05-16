import type { MonetizationOffer, Patient } from "@/lib/types";
import { Button } from "@/components/button";
import { getOfferSubtitle } from "@/modules/monetization/pricing";

export function PatientOfferForm({
  patients,
  offers,
  action,
}: {
  patients: Patient[];
  offers: MonetizationOffer[];
  action: (formData: FormData) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-4 rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div>
        <p className="text-sm font-semibold text-black/75">Assign to patient</p>
        <p className="mt-1 text-xs leading-5 text-black/45">Track package or membership usage manually.</p>
      </div>

      <label className="block text-sm font-semibold text-black/65">
        Patient
        <select name="patient_id" required className="mt-2 h-14 w-full rounded-2xl border border-axiel-line bg-white px-4 text-sm outline-none focus:border-black/25">
          <option value="">Choose patient</option>
          {patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.full_name}</option>)}
        </select>
      </label>

      <label className="block text-sm font-semibold text-black/65">
        Offer
        <select name="offer_id" required className="mt-2 h-14 w-full rounded-2xl border border-axiel-line bg-white px-4 text-sm outline-none focus:border-black/25">
          <option value="">Choose offer</option>
          {offers.map((offer) => <option key={offer.id} value={offer.id}>{offer.name} — {getOfferSubtitle(offer)}</option>)}
        </select>
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-semibold text-black/65">
          Sessions included
          <input name="sessions_total" type="number" min="1" max="500" required defaultValue="4" className="mt-2 h-14 w-full rounded-2xl border border-axiel-line bg-white px-4 text-sm outline-none focus:border-black/25" />
        </label>
        <label className="block text-sm font-semibold text-black/65">
          Start date
          <input name="starts_at" type="date" required defaultValue={today} className="mt-2 h-14 w-full rounded-2xl border border-axiel-line bg-white px-4 text-sm outline-none focus:border-black/25" />
        </label>
      </div>

      <label className="block text-sm font-semibold text-black/65">
        Notes
        <textarea name="notes" rows={3} placeholder="Optional internal note" className="mt-2 w-full rounded-2xl border border-axiel-line bg-white px-4 py-3 text-sm outline-none focus:border-black/25" />
      </label>

      <Button className="min-h-14 w-full text-base">Assign offer</Button>
    </form>
  );
}
