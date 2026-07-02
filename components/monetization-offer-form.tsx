"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

export function MonetizationOfferForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  const t = useTranslations("settings.monetization.offerForm");
  const formRef = useRef<HTMLFormElement>(null);
  const [offerType, setOfferType] = useState("session_package");

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-[14px] bg-white border border-black/[.07] rounded-[12px] px-[20px] py-[18px]"
    >
      <div className="mb-[4px]">
        <p className="text-[14px] font-medium text-[#0F1A2E]">{t("title")}</p>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">{t("subtitle")}</p>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-[#6B6A66] mb-[5px]">{t("nameLabel")}</label>
        <input
          name="name"
          required
          placeholder={t("namePlaceholder")}
          className="h-10 w-full rounded-[8px] border border-black/[.08] bg-[#FAFAF8] px-3 text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56]/40 focus:bg-white transition"
        />
      </div>

      <div className="grid gap-3 grid-cols-2">
        <div>
          <label className="block text-[11px] font-medium text-[#6B6A66] mb-[5px]">{t("typeLabel")}</label>
          <select
            name="offer_type"
            value={offerType}
            onChange={(e) => setOfferType(e.target.value)}
            className="h-10 w-full rounded-[8px] border border-black/[.08] bg-[#FAFAF8] px-3 text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56]/40 focus:bg-white transition"
          >
            <option value="session_package">{t("typePackage")}</option>
            <option value="membership">{t("typeMembership")}</option>
          </select>
        </div>
        {offerType === "membership" ? (
          <div>
            <label className="block text-[11px] font-medium text-[#6B6A66] mb-[5px]">{t("billingLabel")}</label>
            <select
              name="billing_interval"
              className="h-10 w-full rounded-[8px] border border-black/[.08] bg-[#FAFAF8] px-3 text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56]/40 focus:bg-white transition"
            >
              <option value="monthly">{t("billingMonthly")}</option>
              <option value="yearly">{t("billingYearly")}</option>
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-[11px] font-medium text-[#6B6A66] mb-[5px]">{t("sessionsLabel")}</label>
            <input
              name="number_of_sessions"
              type="number"
              min="1"
              max="500"
              required
              defaultValue="4"
              className="h-10 w-full rounded-[8px] border border-black/[.08] bg-[#FAFAF8] px-3 text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56]/40 focus:bg-white transition"
            />
          </div>
        )}
      </div>

      <div className="grid gap-3 grid-cols-[1fr_90px]">
        <div>
          <label className="block text-[11px] font-medium text-[#6B6A66] mb-[5px]">{t("priceLabel")}</label>
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            required
            placeholder={t("pricePlaceholder")}
            className="h-10 w-full rounded-[8px] border border-black/[.08] bg-[#FAFAF8] px-3 text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56]/40 focus:bg-white transition"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-[#6B6A66] mb-[5px]">{t("currencyLabel")}</label>
          <input
            name="currency"
            defaultValue="BRL"
            maxLength={3}
            className="h-10 w-full rounded-[8px] border border-black/[.08] bg-[#FAFAF8] px-3 text-[13px] text-[#0F1A2E] uppercase outline-none focus:border-[#0F6E56]/40 focus:bg-white transition"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-[#6B6A66] mb-[5px]">{t("descriptionLabel")}</label>
        <textarea
          name="description"
          rows={2}
          placeholder={t("descriptionPlaceholder")}
          className="w-full rounded-[8px] border border-black/[.08] bg-[#FAFAF8] px-3 py-2.5 text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56]/40 focus:bg-white transition resize-none"
        />
      </div>

      <button
        type="submit"
        className="w-full h-10 flex items-center justify-center text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-[8px] transition"
      >
        {t("submit")}
      </button>
    </form>
  );
}
