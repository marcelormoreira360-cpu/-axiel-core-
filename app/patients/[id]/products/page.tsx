import { notFound } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { getPatientById } from "@/services/patient-service";
import { getCurrentClinic } from "@/services/clinic-service";
import { getPatientProducts, getProducts } from "@/services/product-service";
import type { DbPatientProduct } from "@/services/product-service";
import { addPatientProductAction, updatePatientProductStatusAction } from "./actions";
import { SubmitButton } from "@/components/submit-button";

const STATUS_CLASSES: Record<DbPatientProduct["status"], string> = {
  active: "bg-[#E1F5EE] dark:bg-[#0F6E56]/20 text-[#0F6E56] dark:text-[#9FE1CB]",
  paused: "bg-[#FEF3C7] dark:bg-[#C77D17]/[.15] text-[#92400E] dark:text-[#E8B04B]",
  completed: "bg-[#F4F3EF] text-[#6B6A66]",
  canceled: "bg-[#FEE2E2] dark:bg-[#B42318]/[.18] text-[#991B1B] dark:text-[#F2B8B5]",
};

const inputClass =
  "w-full rounded-[10px] border border-black/[.10] dark:border-white/[.10] bg-white px-[13px] py-[9px] text-[13px] text-[#0F1A2E] placeholder-[#A09E98] outline-none focus:border-[#0F6E56] transition";

const labelClass = "flex flex-col gap-[5px] text-[12px] font-medium text-[#0F1A2E]";

function formatDate(value: string | null, locale: string) {
  if (!value) return null;
  // review_date vem como "YYYY-MM-DD"; new Date(str) parsearia como UTC meia-noite
  // e exibiria o dia anterior em fusos ocidentais. Construir como data LOCAL.
  const [y, m, d] = value.split("-").map(Number);
  const date =
    Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)
      ? new Date(y, m - 1, d)
      : new Date(value);
  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function PatientProductsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("products.patientProducts");
  const locale = await getLocale();

  const clinic = await getCurrentClinic();
  const [patient, patientProducts, catalogProducts] = await Promise.all([
    getPatientById(id, clinic?.id ?? undefined),
    getPatientProducts(id),
    getProducts(),
  ]);

  if (!patient) notFound();

  const activeProducts = patientProducts.filter((p) => p.status === "active");

  return (
    <Shell>
      {/* Back */}
      <div className="flex items-center gap-[10px] mb-[24px]">
        <BackLink
          fallbackHref={`/patients/${id}`}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </BackLink>
        <div>
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">
            {t("heading", { name: patient.full_name })}
          </h1>
          <p className="text-[12px] text-[#A09E98] mt-[1px]">
            {t("activeCount", { count: activeProducts.length })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[18px]">
        {/* Left: product list */}
        <div className="lg:col-span-2 space-y-[10px]">
          {patientProducts.length === 0 ? (
            <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[32px] flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F4F3EF] flex items-center justify-center mb-4">
                <Package className="h-5 w-5 text-[#A09E98]" />
              </div>
              <p className="text-[13px] font-medium text-[#0F1A2E] mb-1">
                {t("emptyTitle")}
              </p>
              <p className="text-[12px] text-[#6B6A66] max-w-xs">
                {t("emptyText")}
              </p>
            </div>
          ) : (
            patientProducts.map((pp) => (
              <div
                key={pp.id}
                className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]"
              >
                <div className="flex items-start justify-between gap-2 mb-[8px]">
                  <p className="text-[13px] font-medium text-[#0F1A2E] leading-snug">
                    {pp.product_name}
                  </p>
                  <span
                    className={`shrink-0 text-[10px] font-medium px-[8px] py-[2px] rounded-full ${STATUS_CLASSES[pp.status]}`}
                  >
                    {t(`status.${pp.status}`)}
                  </span>
                </div>

                {pp.reason && (
                  <p className="text-[12px] text-[#6B6A66] leading-relaxed mb-[6px]">
                    {pp.reason}
                  </p>
                )}

                {pp.review_date && (
                  <p className="text-[11px] text-[#A09E98]">
                    {t("reviewOn")} {formatDate(pp.review_date, locale)}
                  </p>
                )}

                {/* Status actions */}
                {pp.status === "active" && (
                  <div className="flex flex-wrap gap-[6px] mt-[10px]">
                    <form action={updatePatientProductStatusAction}>
                      <input type="hidden" name="id" value={pp.id} />
                      <input type="hidden" name="patient_id" value={id} />
                      <input type="hidden" name="status" value="paused" />
                      <SubmitButton
                        className="text-[11px] font-medium text-[#92400E] dark:text-[#E8B04B] bg-[#FEF3C7] dark:bg-[#C77D17]/[.15] hover:bg-[#FDE68A] dark:hover:bg-[#C77D17]/30 transition px-[10px] py-[5px] rounded-lg"
                      >
                        {t("pause")}
                      </SubmitButton>
                    </form>
                    <form action={updatePatientProductStatusAction}>
                      <input type="hidden" name="id" value={pp.id} />
                      <input type="hidden" name="patient_id" value={id} />
                      <input type="hidden" name="status" value="completed" />
                      <SubmitButton
                        className="text-[11px] font-medium text-[#6B6A66] bg-[#F4F3EF] hover:bg-[#EEECEA] dark:hover:bg-white/[.08] transition px-[10px] py-[5px] rounded-lg"
                      >
                        {t("complete")}
                      </SubmitButton>
                    </form>
                    <form action={updatePatientProductStatusAction}>
                      <input type="hidden" name="id" value={pp.id} />
                      <input type="hidden" name="patient_id" value={id} />
                      <input type="hidden" name="status" value="canceled" />
                      <SubmitButton
                        className="text-[11px] font-medium text-[#991B1B] dark:text-[#F2B8B5] bg-[#FEE2E2] dark:bg-[#B42318]/[.18] hover:bg-[#FECACA] dark:hover:bg-[#B42318]/30 transition px-[10px] py-[5px] rounded-lg"
                      >
                        {t("cancel")}
                      </SubmitButton>
                    </form>
                  </div>
                )}

                {pp.status === "paused" && (
                  <div className="flex flex-wrap gap-[6px] mt-[10px]">
                    <form action={updatePatientProductStatusAction}>
                      <input type="hidden" name="id" value={pp.id} />
                      <input type="hidden" name="patient_id" value={id} />
                      <input type="hidden" name="status" value="active" />
                      <SubmitButton
                        className="text-[11px] font-medium text-[#0F6E56] dark:text-[#9FE1CB] bg-[#E1F5EE] dark:bg-[#0F6E56]/20 hover:bg-[#C3EBD8] dark:hover:bg-[#0F6E56]/30 transition px-[10px] py-[5px] rounded-lg"
                      >
                        {t("reactivate")}
                      </SubmitButton>
                    </form>
                    <form action={updatePatientProductStatusAction}>
                      <input type="hidden" name="id" value={pp.id} />
                      <input type="hidden" name="patient_id" value={id} />
                      <input type="hidden" name="status" value="canceled" />
                      <SubmitButton
                        className="text-[11px] font-medium text-[#991B1B] dark:text-[#F2B8B5] bg-[#FEE2E2] dark:bg-[#B42318]/[.18] hover:bg-[#FECACA] dark:hover:bg-[#B42318]/30 transition px-[10px] py-[5px] rounded-lg"
                      >
                        {t("cancel")}
                      </SubmitButton>
                    </form>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Right: add product form */}
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px] self-start">
          <p className="text-[12px] font-medium text-[#0F1A2E] mb-[14px]">
            {t("addTitle")}
          </p>
          <form action={addPatientProductAction} className="grid gap-[12px]">
            <input type="hidden" name="patient_id" value={id} />

            {/* Select from catalog OR type custom name */}
            {catalogProducts.length > 0 && (
              <label className={labelClass}>
                {t("selectCatalog")}
                <select name="product_id" className={inputClass} defaultValue="">
                  <option value="">{t("customOption")}</option>
                  {catalogProducts
                    .filter((p) => p.is_active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
            )}

            <label className={labelClass}>
              {t("productName")}
              <input
                name="product_name"
                required
                className={inputClass}
                placeholder={t("productNamePlaceholder")}
              />
            </label>

            <label className={labelClass}>
              {t("reason")}
              <textarea
                name="reason"
                rows={2}
                className={inputClass}
                placeholder={t("reasonPlaceholder")}
              />
            </label>

            <label className={labelClass}>
              {t("reviewDate")}
              <input name="review_date" type="date" className={inputClass} />
            </label>

            <SubmitButton
              className="flex items-center justify-center gap-1.5 text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[14px] py-[8px] rounded-lg"
            >
              {t("addButton")}
            </SubmitButton>
          </form>
        </div>
      </div>
    </Shell>
  );
}
