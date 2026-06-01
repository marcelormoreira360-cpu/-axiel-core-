"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { registerPaymentAction } from "./actions";

const METHOD_KEYS = ["pix", "credit_card", "debit_card", "cash", "transfer", "insurance", "other"] as const;

interface Props {
  patients: { id: string; full_name: string }[];
  defaultPatientId?: string;
  defaultAppointmentId?: string;
  defaultAmount?: number; // in cents
  onClose: () => void;
  onSuccess: () => void;
}

export function RegisterPaymentModal({
  patients,
  defaultPatientId = "",
  defaultAppointmentId = "",
  defaultAmount = 0,
  onClose,
  onSuccess,
}: Props) {
  const t = useTranslations("finance.modal");
  const tm = useTranslations("finance.methods");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const defaultAmountStr = defaultAmount > 0
    ? (defaultAmount / 100).toFixed(2).replace(".", ",")
    : "";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await registerPaymentAction(formData);
      if (result.error) { setError(result.error); return; }
      onSuccess();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#0F1A2E]">{t("title")}</h2>
          <button onClick={onClose} className="text-black/35 hover:text-[#0F1A2E] transition">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Hidden fields */}
          {defaultAppointmentId && (
            <input type="hidden" name="appointment_id" value={defaultAppointmentId} />
          )}

          {/* Paciente */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0F1A2E]">{t("patient")}</label>
            <select
              name="patient_id"
              defaultValue={defaultPatientId}
              required
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1F3A]/20"
            >
              <option value="">{t("selectPatient")}</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>

          {/* Valor */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0F1A2E]">{t("amount")}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-black/40">R$</span>
              <input
                name="amount"
                type="text"
                inputMode="decimal"
                defaultValue={defaultAmountStr}
                placeholder="0,00"
                required
                className="w-full rounded-lg border border-black/15 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1F3A]/20"
              />
            </div>
          </div>

          {/* Forma de pagamento */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0F1A2E]">{t("method")}</label>
            <div className="grid grid-cols-2 gap-2">
              {METHOD_KEYS.map((m) => (
                <label
                  key={m}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm has-[:checked]:border-[#0B1F3A] has-[:checked]:bg-[#0B1F3A]/[.04] transition"
                >
                  <input type="radio" name="payment_method" value={m} required className="accent-[#0B1F3A]" />
                  {tm(m)}
                </label>
              ))}
            </div>
          </div>

          {/* Data */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0F1A2E]">{t("date")}</label>
            <input
              name="paid_at"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1F3A]/20"
            />
          </div>

          {/* Notas */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#0F1A2E]">{t("notes")}</label>
            <input
              name="notes"
              type="text"
              placeholder={t("notesPlaceholder")}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1F3A]/20"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-black/15 py-2.5 text-sm font-medium text-[#0F1A2E] hover:bg-[#F4F3EF] transition"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-xl bg-[#0B1F3A] py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-50 transition"
            >
              {isPending ? t("saving") : t("submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
