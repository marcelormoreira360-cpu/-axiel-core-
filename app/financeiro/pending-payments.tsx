"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { formatBRL } from "@/lib/finance-utils";
import { confirmPaymentAction, getPaymentProofUrlAction, discardPendingPaymentAction } from "./actions";
import type { PendingPayment } from "@/services/finance-service";

const KNOWN_METHODS = ["pix", "boleto", "credit_card", "debit_card", "cash", "transfer", "insurance", "other"];

function PendingRow({ payment, locale }: { payment: PendingPayment; locale: string }) {
  const t = useTranslations("finance.pending");
  const tm = useTranslations("finance.methods");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const methodLabel = (m: string | null) =>
    m && KNOWN_METHODS.includes(m) ? tm(m) : (m ?? "—");

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await confirmPaymentAction(payment.id);
      if (res.error) setError(res.error);
    });
  }

  function discard() {
    setError(null);
    startTransition(async () => {
      const res = await discardPendingPaymentAction(payment.id);
      if (res.error) setError(res.error);
    });
  }

  async function openProof() {
    const res = await getPaymentProofUrlAction(payment.id);
    if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
    else setError(res.error ?? t("proofError"));
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-[#0F1A2E] truncate">{payment.patient_name ?? "—"}</p>
          <p className="text-[10px] text-[#A09E98]">
            {new Date(payment.paid_at).toLocaleDateString(locale)} · {methodLabel(payment.payment_method)}
          </p>
        </div>
        <p className="shrink-0 text-[12px] font-semibold text-amber-600">{formatBRL(payment.amount_cents)}</p>
      </div>
      <div className="mt-1.5 flex items-center justify-end gap-1.5">
        {payment.proof_path && (
          <button
            onClick={openProof}
            className="text-[10px] font-medium text-[#6B6A66] border border-black/[.10] hover:bg-[#F4F3EF] rounded-md px-2 py-1 transition"
          >
            {t("viewProof")}
          </button>
        )}
        <button
          onClick={discard}
          disabled={isPending}
          className="text-[10px] font-medium text-[#A09E98] border border-black/[.10] hover:bg-[#F4F3EF] hover:text-rose-500 disabled:opacity-50 rounded-md px-2 py-1 transition"
        >
          {t("discard")}
        </button>
        <button
          onClick={confirm}
          disabled={isPending}
          className="text-[10px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-50 rounded-md px-2.5 py-1 transition"
        >
          {isPending ? t("confirming") : t("confirm")}
        </button>
      </div>
      {error && <p className="text-[9px] text-rose-500 mt-1 text-right">{error}</p>}
    </div>
  );
}

export function PendingPayments({
  payments,
  locale,
}: {
  payments: PendingPayment[];
  locale: string;
}) {
  const t = useTranslations("finance.pending");

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/[.05]">
        <p className="text-[12px] font-medium text-[#0F1A2E]">{t("title")}</p>
        {payments.length > 0 && (
          <span className="text-[10px] font-medium bg-amber-50 text-amber-600 rounded-full px-2 py-0.5">
            {payments.length}
          </span>
        )}
      </div>
      {payments.length === 0 ? (
        <p className="px-4 py-4 text-[11px] text-[#0F6E56]">{t("empty")}</p>
      ) : (
        <div className="divide-y divide-black/[.04] max-h-80 overflow-y-auto">
          {payments.map((p) => (
            <PendingRow key={p.id} payment={p} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
