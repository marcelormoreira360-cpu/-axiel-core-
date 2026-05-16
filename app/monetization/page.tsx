import { redirect } from "next/navigation";
import { CreditCard, Layers3, Repeat, Users } from "lucide-react";
import { Shell } from "@/components/shell";
import { Card } from "@/components/card";
import { MonetizationOfferForm } from "@/components/monetization-offer-form";
import { PatientOfferForm } from "@/components/patient-offer-form";
import { OfferList, PatientOfferList } from "@/components/monetization-lists";
import { getPatients } from "@/services/patient-service";
import { getCurrentUserProfile } from "@/services/user-service";
import {
  assignOfferToPatient,
  createMonetizationOffer,
  getActiveMonetizationOffers,
  getMonetizationOffers,
  getPatientOffers,
  updateMonetizationOfferStatus,
} from "@/services/monetization-service";
import { formatPrice } from "@/modules/monetization/pricing";
import { MONETIZATION_NOTE } from "@/modules/monetization/offer-defaults";
import type { MonetizationOfferType } from "@/lib/types";

export default async function MonetizationPage() {
  const [profile, patients, offers, activeOffers, patientOffers] = await Promise.all([
    getCurrentUserProfile(),
    getPatients(),
    getMonetizationOffers(),
    getActiveMonetizationOffers(),
    getPatientOffers(),
  ]);

  const packages = offers.filter((offer) => offer.offer_type === "session_package");
  const memberships = offers.filter((offer) => offer.offer_type === "membership");
  const activePatientOffers = patientOffers.filter((item) => item.status === "active");
  const totalOfferValue = activeOffers.reduce((total, offer) => total + offer.price_cents, 0);

  async function createOfferAction(formData: FormData) {
    "use server";

    const profile = await getCurrentUserProfile();
    if (!profile?.clinic_id) throw new Error("User must be assigned to a clinic before creating offers.");

    const name = String(formData.get("name") ?? "").trim();
    const offerType = String(formData.get("offer_type") ?? "session_package") as MonetizationOfferType;
    const numberOfSessions = Number(formData.get("number_of_sessions") ?? 1);
    const price = Number(formData.get("price") ?? 0);
    const currency = String(formData.get("currency") ?? "USD").trim().toUpperCase() || "USD";
    const description = String(formData.get("description") ?? "").trim() || null;

    if (!name) throw new Error("Offer name is required.");
    if (!Number.isFinite(price) || price < 0) throw new Error("Price must be zero or greater.");
    if (!Number.isInteger(numberOfSessions) || numberOfSessions < 1) throw new Error("Sessions must be at least 1.");

    await createMonetizationOffer({
      clinic_id: profile.clinic_id,
      name,
      offer_type: offerType,
      price_cents: Math.round(price * 100),
      currency,
      number_of_sessions: numberOfSessions,
      description,
    });

    redirect("/monetization");
  }

  async function toggleOfferAction(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const isActive = String(formData.get("is_active") ?? "false") === "true";
    if (!id) throw new Error("Offer ID is required.");
    await updateMonetizationOfferStatus(id, isActive);
    redirect("/monetization");
  }

  async function assignOfferAction(formData: FormData) {
    "use server";

    const profile = await getCurrentUserProfile();
    if (!profile?.clinic_id) throw new Error("User must be assigned to a clinic before assigning offers.");

    const patientId = String(formData.get("patient_id") ?? "");
    const offerId = String(formData.get("offer_id") ?? "");
    const sessionsTotal = Number(formData.get("sessions_total") ?? 1);
    const startsAt = String(formData.get("starts_at") ?? new Date().toISOString().slice(0, 10));
    const notes = String(formData.get("notes") ?? "").trim() || null;

    if (!patientId || !offerId) throw new Error("Patient and offer are required.");
    if (!Number.isInteger(sessionsTotal) || sessionsTotal < 1) throw new Error("Sessions must be at least 1.");

    await assignOfferToPatient({
      clinic_id: profile.clinic_id,
      patient_id: patientId,
      offer_id: offerId,
      sessions_total: sessionsTotal,
      starts_at: startsAt,
      notes,
    });

    redirect("/monetization");
  }

  return (
    <Shell>
      <header className="mb-8 flex flex-col gap-5 pt-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium tracking-[0.22em] text-axiel-gold">MONETIZATION</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Packages and memberships.</h1>
          <p className="mt-3 max-w-2xl text-black/55">Define simple offers for each clinic. No payment processing is connected yet.</p>
        </div>
      </header>

      <section className="mb-5 grid gap-3 md:grid-cols-4">
        <Card className="bg-axiel-ink p-6 text-white">
          <Layers3 className="h-5 w-5 text-white/45" />
          <p className="mt-3 text-sm text-white/55">Session packages</p>
          <p className="mt-2 text-4xl font-semibold">{packages.length}</p>
        </Card>
        <Card className="p-6">
          <Repeat className="h-5 w-5 text-black/30" />
          <p className="mt-3 text-sm text-black/45">Memberships</p>
          <p className="mt-2 text-4xl font-semibold">{memberships.length}</p>
        </Card>
        <Card className="p-6">
          <Users className="h-5 w-5 text-black/30" />
          <p className="mt-3 text-sm text-black/45">Active patient plans</p>
          <p className="mt-2 text-4xl font-semibold">{activePatientOffers.length}</p>
        </Card>
        <Card className="p-6">
          <CreditCard className="h-5 w-5 text-black/30" />
          <p className="mt-3 text-sm text-black/45">Active offer value</p>
          <p className="mt-2 text-3xl font-semibold">{formatPrice(totalOfferValue)}</p>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-semibold tracking-tight">Clinic offers</h2>
              <p className="text-sm text-black/40">Simple and flexible</p>
            </div>
            <OfferList offers={offers} toggleAction={toggleOfferAction} />
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-semibold tracking-tight">Patient plans</h2>
              <p className="text-sm text-black/40">Manual tracking</p>
            </div>
            <PatientOfferList patientOffers={patientOffers} />
          </div>
        </div>

        <div className="space-y-5">
          {!profile?.clinic_id ? (
            <Card>This user needs to be assigned to a clinic before creating offers.</Card>
          ) : (
            <MonetizationOfferForm action={createOfferAction} />
          )}

          {!profile?.clinic_id ? null : patients.length === 0 ? (
            <Card>Add a patient first. Then return here to assign a package or membership.</Card>
          ) : activeOffers.length === 0 ? (
            <Card>Create an active offer first. Then assign it to a patient.</Card>
          ) : (
            <PatientOfferForm patients={patients} offers={activeOffers} action={assignOfferAction} />
          )}

          <Card className="bg-white">
            <p className="text-sm font-semibold text-black/70">Structure only</p>
            <p className="mt-2 text-sm leading-6 text-black/50">{MONETIZATION_NOTE} Later this can connect to Stripe, invoices, automated renewals, and patient portal payments.</p>
          </Card>
        </div>
      </section>
    </Shell>
  );
}
