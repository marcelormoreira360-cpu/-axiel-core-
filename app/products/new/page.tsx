import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { createProductAction } from "./actions";
import { SubmitButton } from "@/components/submit-button";

const CATEGORIES = [
  "Suplementos",
  "Exames/Testes",
  "Dispositivos",
  "Kits",
  "Produtos Digitais",
  "Add-ons de Sessão",
  "Outro",
] as const;

const inputClass =
  "w-full rounded-[10px] border border-black/[.10] dark:border-white/[.10] bg-white dark:bg-[#111827] px-[13px] py-[10px] text-[13px] text-[#0F1A2E] dark:text-[#E8E6E2] placeholder-[#A09E98] outline-none focus:border-[#0F6E56] transition";

const labelClass = "flex flex-col gap-[6px] text-[12px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2]";

export default async function NewProductPage() {
  const t = await getTranslations("products.newProduct");
  return (
    <Shell>
      {/* Header */}
      <div className="flex items-center gap-[10px] mb-[24px]">
        <BackLink
          fallbackHref="/products"
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] dark:border-white/[.08] text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </BackLink>
        <div>
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E] dark:text-[#E8E6E2]">
            {t("heading")}
          </h1>
          <p className="text-[12px] text-[#A09E98] mt-[1px]">
            {t("subheading")}
          </p>
        </div>
      </div>

      {/* Form card */}
      <div className="bg-white dark:bg-[#111827] border border-black/[.07] dark:border-white/[.07] rounded-[12px] px-[20px] py-[20px] max-w-2xl">
        <form action={createProductAction} className="grid gap-[16px]">
          {/* Nome */}
          <label className={labelClass}>
            {t("name")}
            <input
              name="name"
              required
              className={inputClass}
              placeholder={t("namePlaceholder")}
            />
          </label>

          {/* Categoria */}
          <label className={labelClass}>
            {t("category")}
            <select name="category" className={inputClass} defaultValue="Outro">
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>

          {/* Descrição */}
          <label className={labelClass}>
            {t("description")}
            <textarea
              name="description"
              rows={3}
              className={inputClass}
              placeholder={t("descriptionPlaceholder")}
            />
          </label>

          {/* Preço + Custo */}
          <div className="grid grid-cols-2 gap-[12px]">
            <label className={labelClass}>
              {t("price")}
              <input
                name="price_brl"
                required
                type="text"
                inputMode="decimal"
                className={inputClass}
                placeholder={t("pricePlaceholder")}
              />
            </label>
            <label className={labelClass}>
              {t("cost")}
              <input
                name="cost_brl"
                type="text"
                inputMode="decimal"
                className={inputClass}
                placeholder={t("costPlaceholder")}
              />
            </label>
          </div>

          {/* Estoque + SKU */}
          <div className="grid grid-cols-2 gap-[12px]">
            <label className={labelClass}>
              {t("inventory")}
              <input
                name="inventory_quantity"
                type="number"
                min="0"
                defaultValue="0"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              {t("sku")}
              <input
                name="sku"
                type="text"
                className={inputClass}
                placeholder={t("skuPlaceholder")}
              />
            </label>
          </div>

          {/* Notas de segurança */}
          <label className={labelClass}>
            {t("safetyNotes")}
            <textarea
              name="safety_notes"
              rows={3}
              className={inputClass}
              placeholder={t("safetyNotesPlaceholder")}
            />
          </label>

          {/* Actions */}
          <div className="flex flex-wrap gap-[10px] pt-[4px]">
            <SubmitButton
              className="flex items-center gap-1.5 text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[18px] py-[9px] rounded-lg"
            >
              {t("save")}
            </SubmitButton>
            <Link
              href="/products"
              className="flex items-center text-[13px] font-medium text-[#6B6A66] dark:text-[#9E9C97] bg-[#F4F3EF] dark:bg-white/[.06] hover:bg-[#EEECEA] dark:hover:bg-white/[.08] transition px-[18px] py-[9px] rounded-lg"
            >
              {t("cancel")}
            </Link>
          </div>
        </form>
      </div>
    </Shell>
  );
}
