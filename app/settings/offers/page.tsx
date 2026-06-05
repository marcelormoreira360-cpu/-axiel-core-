import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { getCurrentUserProfile } from "@/services/user-service";
import {
  getMonetizationOffers,
  createMonetizationOffer,
  updateMonetizationOffer,
  updateMonetizationOfferStatus,
  deleteMonetizationOffer,
} from "@/services/monetization-service";
import { OfferList } from "@/components/offer-list";
import type { MonetizationOfferType } from "@/lib/types";
import { getClinicCurrency } from "@/services/finance-service";

export default async function OffersPage() {
  const t = await getTranslations("settings");
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) redirect("/dashboard");

  const offers = await getMonetizationOffers(profile.clinic_id);

  // ── Server actions ──────────────────────────────────────────────────────────

  async function createAction(formData: FormData) {
    "use server";
    const p = await getCurrentUserProfile();
    if (!p?.clinic_id) return;

    const name = String(formData.get("name") ?? "").trim();
    const offer_type = String(formData.get("offer_type") ?? "session_package") as MonetizationOfferType;
    const price_cents = Math.round(Number(formData.get("price_brl") ?? 0) * 100);
    const number_of_sessions = Number(formData.get("number_of_sessions") ?? 1);
    const description = String(formData.get("description") ?? "").trim() || null;
    const billing_interval_raw = String(formData.get("billing_interval") ?? "");
    const billing_interval =
      offer_type === "membership" && (billing_interval_raw === "monthly" || billing_interval_raw === "yearly")
        ? billing_interval_raw
        : null;

    if (!name) return;

    await createMonetizationOffer({
      clinic_id: p.clinic_id,
      name,
      offer_type,
      price_cents,
      currency: await getClinicCurrency(p.clinic_id),
      number_of_sessions,
      description,
      billing_interval,
    });

    revalidatePath("/settings/offers");
  }

  async function editAction(id: string, formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    const price_cents = Math.round(Number(formData.get("price_brl") ?? 0) * 100);
    const number_of_sessions = Number(formData.get("number_of_sessions") ?? 1);
    const description = String(formData.get("description") ?? "").trim() || null;
    const billing_interval_raw = String(formData.get("billing_interval") ?? "");
    const billing_interval =
      billing_interval_raw === "monthly" || billing_interval_raw === "yearly"
        ? billing_interval_raw
        : null;

    if (!name) return;

    await updateMonetizationOffer(id, {
      name,
      price_cents,
      number_of_sessions,
      description,
      ...(billing_interval ? { billing_interval } : {}),
    });

    revalidatePath("/settings/offers");
  }

  async function toggleActiveAction(id: string, isActive: boolean) {
    "use server";
    await updateMonetizationOfferStatus(id, isActive);
    revalidatePath("/settings/offers");
  }

  async function deleteAction(id: string) {
    "use server";
    await deleteMonetizationOffer(id);
    revalidatePath("/settings/offers");
  }

  return (
    <Shell>
      <div className="mb-7">
        <Link
          href="/settings"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t("common.back")}
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">{t("common.eyebrow")}</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">{t("offers.title")}</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">
          {t("offers.subtitle")}
        </p>
      </div>

      <OfferList
        offers={offers}
        createAction={createAction}
        editAction={editAction}
        toggleActiveAction={toggleActiveAction}
        deleteAction={deleteAction}
      />
    </Shell>
  );
}
