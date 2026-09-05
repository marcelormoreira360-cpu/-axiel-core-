"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, X, Repeat, Power } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import {
  addPayableAction,
  addRecurringAction,
  toggleRecurringAction,
  deleteRecurringAction,
} from "./actions";

const inputCls =
  "w-full text-[13px] text-[#0F1A2E] bg-white border border-black/[.10] dark:border-white/[.10] rounded-[8px] px-[10px] py-[8px] outline-none focus:border-[#0F6E56]/50 transition";
const labelCls = "text-[10px] font-medium text-[#6B6A66] mb-[4px] block";

type SupplierOpt = { id: string; name: string };

function SupplierPicker({ suppliers }: { suppliers: SupplierOpt[] }) {
  const t = useTranslations("finance.payables");
  const [creating, setCreating] = useState(suppliers.length === 0);
  return (
    <div>
      <label className={labelCls}>{t("supplier")}</label>
      {creating ? (
        <input name="supplier_name" maxLength={80} placeholder={t("supplierPlaceholder")} className={inputCls} />
      ) : (
        <select
          name="supplier_id"
          className={inputCls}
          defaultValue=""
          onChange={(e) => {
            if (e.target.value === "__new__") setCreating(true);
          }}
        >
          <option value="">{t("supplierNone")}</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          <option value="__new__">{t("supplierNew")}</option>
        </select>
      )}
    </div>
  );
}

export function AddPayableForm({ suppliers }: { suppliers: SupplierOpt[] }) {
  const t = useTranslations("finance.payables");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-[6px] text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-[8px] px-[12px] py-[8px] transition"
      >
        <Plus className="h-3.5 w-3.5" /> {t("addPayable")}
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await addPayableAction(fd);
        setOpen(false);
      }}
      className="bg-[#FAFAF8] dark:bg-white/[.03] border border-black/[.07] rounded-[12px] p-[14px] space-y-[10px]"
    >
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium text-[#0F1A2E]">{t("newPayable")}</p>
        <button type="button" onClick={() => setOpen(false)} aria-label={t("cancel")} className="text-[#A09E98] hover:text-[#0F1A2E]">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div>
        <label className={labelCls}>{t("description")}</label>
        <input name="description" maxLength={200} required placeholder={t("descriptionPlaceholder")} className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-[8px]">
        <div>
          <label className={labelCls}>{t("amount")}</label>
          <input name="amount" type="number" step="0.01" min="0.01" required placeholder="0,00" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("dueDate")}</label>
          <input name="due_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-[8px]">
        <SupplierPicker suppliers={suppliers} />
        <div>
          <label className={labelCls}>{t("category")}</label>
          <input name="category" maxLength={60} placeholder={t("categoryPlaceholder")} className={inputCls} />
        </div>
      </div>

      <SubmitButton className="w-full flex items-center justify-center gap-[6px] text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-70 rounded-[8px] py-[9px] transition">
        {t("save")}
      </SubmitButton>
    </form>
  );
}

type RecurringItem = {
  id: string;
  description: string;
  amount_cents: number;
  day_of_month: number;
  active: boolean;
  supplier_name?: string | null;
};

export function RecurringManager({
  recurring,
  suppliers,
  money,
}: {
  recurring: RecurringItem[];
  suppliers: SupplierOpt[];
  money: (c: number) => string;
}) {
  const t = useTranslations("finance.payables");
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  return (
    <div className="bg-white border border-black/[.07] rounded-[14px] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-[8px] px-[16px] py-[12px] border-b border-black/[.05] text-left"
      >
        <Repeat className="h-3.5 w-3.5 text-[#0F6E56]" />
        <span className="text-[12px] font-medium text-[#0F1A2E] flex-1">{t("recurringTitle")}</span>
        <span className="text-[10px] text-[#A09E98]">{t("recurringCount", { count: recurring.length })}</span>
        <span className="text-[#A09E98] text-[12px]">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div>
          <div className="divide-y divide-black/[.04]">
            {recurring.length === 0 ? (
              <p className="text-[12px] text-[#A09E98] px-[16px] py-[18px] text-center">{t("recurringEmpty")}</p>
            ) : (
              recurring.map((r) => (
                <div key={r.id} className="flex items-center gap-[10px] px-[16px] py-[10px]">
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] truncate ${r.active ? "text-[#0F1A2E]" : "text-[#A09E98] line-through"}`}>
                      {r.description}
                    </p>
                    <p className="text-[10px] text-[#A09E98]">
                      {t("dayOfMonthShort", { day: r.day_of_month })}
                      {r.supplier_name ? ` · ${r.supplier_name}` : ""}
                    </p>
                  </div>
                  <p className="text-[13px] font-medium text-[#B42318] shrink-0">{money(r.amount_cents)}</p>
                  <form action={toggleRecurringAction.bind(null, r.id, !r.active)}>
                    <SubmitButton
                      className={`w-6 h-6 flex items-center justify-center rounded-md transition shrink-0 ${
                        r.active ? "text-[#0F6E56] hover:bg-[#0F6E56]/[.08]" : "text-[#A09E98] hover:bg-black/[.05]"
                      }`}
                      title={r.active ? t("pause") : t("resume")}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </SubmitButton>
                  </form>
                  <form action={deleteRecurringAction.bind(null, r.id)}>
                    <SubmitButton className="w-6 h-6 flex items-center justify-center rounded-md text-[#A09E98] hover:text-[#B42318] hover:bg-[#B42318]/[.06] transition shrink-0">
                      <X className="h-3.5 w-3.5" />
                    </SubmitButton>
                  </form>
                </div>
              ))
            )}
          </div>

          <div className="px-[16px] py-[12px] border-t border-black/[.05]">
            {adding ? (
              <form
                action={async (fd) => {
                  await addRecurringAction(fd);
                  setAdding(false);
                }}
                className="space-y-[10px]"
              >
                <div>
                  <label className={labelCls}>{t("description")}</label>
                  <input name="description" maxLength={200} required placeholder={t("recurringPlaceholder")} className={inputCls} />
                </div>
                <div className="grid grid-cols-3 gap-[8px]">
                  <div>
                    <label className={labelCls}>{t("amount")}</label>
                    <input name="amount" type="number" step="0.01" min="0.01" required placeholder="0,00" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{t("dayOfMonth")}</label>
                    <input name="day_of_month" type="number" min="1" max="31" defaultValue="1" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{t("category")}</label>
                    <input name="category" maxLength={60} placeholder={t("categoryPlaceholder")} className={inputCls} />
                  </div>
                </div>
                <SupplierPicker suppliers={suppliers} />
                <div className="flex gap-[8px]">
                  <SubmitButton className="flex-1 text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-70 rounded-[8px] py-[9px] transition">
                    {t("save")}
                  </SubmitButton>
                  <button type="button" onClick={() => setAdding(false)} className="text-[12px] text-[#6B6A66] px-[12px]">
                    {t("cancel")}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex items-center gap-[6px] text-[12px] font-medium text-[#0F6E56] hover:text-[#085041] transition"
              >
                <Plus className="h-3.5 w-3.5" /> {t("addRecurring")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
