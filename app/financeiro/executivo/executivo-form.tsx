"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { addFinEntryAction } from "./actions";

export function AddFinEntryForm() {
  const t = useTranslations("finance.executive");
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"expense" | "revenue">("expense");

  const inputCls =
    "w-full text-[13px] text-[#0F1A2E] bg-white border border-black/[.10] dark:border-white/[.10] rounded-[8px] px-[10px] py-[8px] outline-none focus:border-[#0F6E56]/50 transition";
  const labelCls = "text-[10px] font-medium text-[#6B6A66] mb-[4px] block";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-[6px] text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-[8px] px-[12px] py-[8px] transition"
      >
        <Plus className="h-3.5 w-3.5" /> {t("addEntry")}
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await addFinEntryAction(fd);
        setOpen(false);
        setKind("expense");
      }}
      className="bg-[#FAFAF8] dark:bg-white/[.03] border border-black/[.07] rounded-[12px] p-[14px] space-y-[10px]"
    >
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium text-[#0F1A2E]">{t("newEntry")}</p>
        <button type="button" onClick={() => setOpen(false)} aria-label={t("cancel")} className="text-[#A09E98] hover:text-[#0F1A2E]">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-[8px]">
        <div>
          <label className={labelCls}>{t("kind")}</label>
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as "expense" | "revenue")} className={inputCls}>
            <option value="expense">{t("kindExpense")}</option>
            <option value="revenue">{t("kindRevenue")}</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>{t("amount")}</label>
          <input name="amount" type="number" step="0.01" min="0.01" required placeholder="0,00" className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-[8px]">
        <div>
          <label className={labelCls}>{t("date")}</label>
          <input name="entry_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("category")}</label>
          <input name="category" maxLength={60} placeholder={t("categoryPlaceholder")} className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>{t("description")}</label>
        <input name="description" maxLength={200} placeholder={t("descriptionPlaceholder")} className={inputCls} />
      </div>

      <SubmitButton className="w-full flex items-center justify-center gap-[6px] text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-70 rounded-[8px] py-[9px] transition">
        {t("save")}
      </SubmitButton>
    </form>
  );
}
