import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
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
  deleteMonetizationOffer,
  getActiveMonetizationOffers,
  getMonetizationOffers,
  getPatientOffers,
  updateMonetizationOffer,
  updateMonetizationOfferStatus,
} from "@/services/monetization-service";
import { formatPrice } from "@/modules/monetization/pricing";
import { MONETIZATION_NOTE } from "@/modules/monetization/offer-defaults";
import type { MonetizationOfferType } from "@/lib/types";

export default async function MonetizationPage() {
  const t = await getTranslations("monetization");
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
    const isMembership = offerType === "membership";
    const numberOfSessions = isMembership ? 0 : Number(formData.get("number_of_sessions") ?? 1);
    const billingIntervalRaw = String(formData.get("billing_interval") ?? "monthly");
    const billingInterval = isMembership
      ? (billingIntervalRaw === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly"
      : null;
    const price = Number(formData.get("price") ?? 0);
    const currency = String(formData.get("currency") ?? "BRL").trim().toUpperCase() || "BRL";
    const description = String(formData.get("description") ?? "").trim() || null;

    if (!name) throw new Error("Offer name is required.");
    if (!Number.isFinite(price) || price < 0) throw new Error("Price must be zero or greater.");
    if (!isMembership && (!Number.isInteger(numberOfSessions) || numberOfSessions < 1)) throw new Error("Sessions must be at least 1.");

    await createMonetizationOffer({
      clinic_id: profile.clinic_id,
      name,
      offer_type: offerType,
      price_cents: Math.round(price * 100),
      currency,
      number_of_sessions: isMembership ? 1 : numberOfSessions,
      description,
      billing_interval: billingInterval,
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

  async function editOfferAction(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const price_cents = Math.round(Number(formData.get("price_brl") ?? 0) * 100);
    const number_of_sessions = Number(formData.get("number_of_sessions") ?? 1);
    const description = String(formData.get("description") ?? "").trim() || null;
    const billing_interval_raw = String(formData.get("billing_interval") ?? "");
    const billing_interval =
      billing_interval_raw === "monthly" || billing_interval_raw === "yearly"
        ? billing_interval_raw as "monthly" | "yearly"
        : null;
    if (!id || !name) return;
    await updateMonetizationOffer(id, {
      name,
      price_cents,
      number_of_sessions,
      description,
      ...(billing_interval ? { billing_interval } : {}),
    });
    redirect("/monetization");
  }

  async function deleteOfferAction(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    await deleteMonetizationOffer(id);
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
          <p className="text-sm font-medium tracking-[0.22em] text-axiel-gold">{t("eyebrow")}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">{t("title")}</h1>
          <p className="mt-3 max-w-2xl text-black/55">{t("subtitle")}</p>
        </div>
      </header>

      <section className="mb-5 grid gap-3 md:grid-cols-4">
        <Card className="bg-axiel-ink p-6 text-white">
          <Layers3 className="h-5 w-5 text-white/45" />
          <p className="mt-3 text-sm text-white/55">{t("kpiPackages")}</p>
          <p className="mt-2 text-4xl font-semibold">{packages.length}</p>
        </Card>
        <Card className="p-6">
          <Repeat className="h-5 w-5 text-black/30" />
          <p className="mt-3 text-sm text-black/45">{t("kpiMemberships")}</p>
          <p className="mt-2 text-4xl font-semibold">{memberships.length}</p>
        </Card>
        <Card className="p-6">
          <Users className="h-5 w-5 text-black/30" />
          <p className="mt-3 text-sm text-black/45">{t("kpiActivePlans")}</p>
          <p className="mt-2 text-4xl font-semibold">{activePatientOffers.length}</p>
        </Card>
        <Card className="p-6">
          <CreditCard className="h-5 w-5 text-black/30" />
          <p className="mt-3 text-sm text-black/45">{t("kpiOfferValue")}</p>
          <p className="mt-2 text-3xl font-semibold">{formatPrice(totalOfferValue)}</p>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-semibold tracking-tight">{t("offersTitle")}</h2>
              <p className="text-sm text-black/40">{t("offersSubtitle")}</p>
            </div>
            <OfferList
              offers={offers}
              toggleAction={toggleOfferAction}
              editAction={editOfferAction}
              deleteAction={deleteOfferAction}
            />
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-semibold tracking-tight">{t("plansTitle")}</h2>
              <p className="text-sm text-black/40">{t("plansSubtitle")}</p>
            </div>
            <PatientOfferList patientOffers={patientOffers} />
          </div>
        </div>

        <div className="space-y-5">
          {!profile?.clinic_id ? (
            <Card>{t("noClinic")}</Card>
          ) : (
            <MonetizationOfferForm action={createOfferAction} />
          )}

          {!profile?.clinic_id ? null : patients.length === 0 ? (
            <Card>{t("addPatientFirst")}</Card>
          ) : activeOffers.length === 0 ? (
            <Card>{t("createOfferFirst")}</Card>
          ) : (
            <PatientOfferForm patients={patients} offers={activeOffers} action={assignOfferAction} />
          )}

          <Card className="bg-white">
            <p className="text-sm font-semibold text-black/70">{t("structureOnly")}</p>
            <p className="mt-2 text-sm leading-6 text-black/50">{MONETIZATION_NOTE} {t("structureNoteTail")}</p>
          </Card>
        </div>
      </section>
    </Shell>
  );
}
