"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { FeeDecisionRow } from "@/services/fee-decision-service";
import { decidirCobrarAction, decidirDispensarAction } from "./actions";

function money(cents: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

// Converte centavos em string editável no formato "75.00" (input controlado).
function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function PendingRow({ row, locale }: { row: FeeDecisionRow; locale: string }) {
  const t = useTranslations("feeDecisions");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>(centsToInput(row.suggested_amount_cents));
  const [notes, setNotes] = useState<string>("");
  const [mode, setMode] = useState<null | "cobrar" | "dispensar">(null);

  const triggerLabel = row.trigger_status === "no_show" ? t("triggerNoShow") : t("triggerLateCancel");

  function submitCobrar() {
    setError(null);
    startTransition(async () => {
      const res = await decidirCobrarAction({ decisionId: row.id, amount, notes: notes || null });
      if (res.error) setError(res.error);
    });
  }

  function submitDispensar() {
    setError(null);
    startTransition(async () => {
      const res = await decidirDispensarAction({ decisionId: row.id, notes: notes || null });
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <Link
            href={`/patients/${row.patient_id}`}
            className="text-[13px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] hover:underline truncate"
          >
            {row.patient_name ?? t("unknownPatient")}
          </Link>
          <p className="text-[10px] text-[#A09E98] mt-[2px]">
            {row.starts_at ? new Date(row.starts_at).toLocaleString(locale) : ""}
            {row.session_type_name ? ` · ${row.session_type_name}` : ""}
          </p>
          <div className="flex items-center gap-2 mt-[5px] flex-wrap">
            <span
              className={`text-[10px] px-[8px] py-[2px] rounded-full ${
                row.trigger_status === "no_show"
                  ? "bg-rose-50 text-rose-600"
                  : "bg-amber-50 text-amber-600"
              }`}
            >
              {triggerLabel}
            </span>
            {row.suggested_reason === "none" && (
              <span className="text-[10px] text-[#A09E98]">{t("reasonNone")}</span>
            )}
            {row.suggested_reason === "courtesy" && (
              <span className="text-[10px] text-[#0F6E56]">{t("reasonCourtesy")}</span>
            )}
            {row.suggested_reason === "percent_fallback" && (
              <span className="text-[10px] text-[#A09E98]">{t("reasonFallback")}</span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-[#A09E98]">{t("suggested")}</p>
          <p className="text-[14px] font-semibold text-[#0F1A2E] dark:text-[#E8E6E2]">
            {money(row.suggested_amount_cents, row.currency, locale)}
          </p>
        </div>
      </div>

      {mode === null && (
        <div className="mt-2 flex items-center justify-end gap-1.5">
          <button
            onClick={() => setMode("dispensar")}
            className="text-[10px] font-medium text-[#A09E98] border border-black/[.10] dark:border-white/[.10] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] rounded-md px-2.5 py-1 transition"
          >
            {t("waive")}
          </button>
          <button
            onClick={() => setMode("cobrar")}
            className="text-[10px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-md px-2.5 py-1 transition"
          >
            {t("charge")}
          </button>
        </div>
      )}

      {mode === "cobrar" && (
        <div className="mt-2 rounded-md bg-[#FAFAF8] dark:bg-white/[.03] border border-black/[.06] dark:border-white/[.06] p-3">
          <label className="block text-[10px] text-[#6B6A66] dark:text-[#9E9C97] mb-1">
            {t("amountLabel", { currency: row.currency })}
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-32 text-[12px] rounded-md border border-black/[.12] dark:border-white/[.12] bg-white dark:bg-[#111827] px-2 py-1 text-[#0F1A2E] dark:text-[#E8E6E2]"
          />
          <label className="block text-[10px] text-[#6B6A66] dark:text-[#9E9C97] mt-2 mb-1">{t("notesOptional")}</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full text-[12px] rounded-md border border-black/[.12] dark:border-white/[.12] bg-white dark:bg-[#111827] px-2 py-1 text-[#0F1A2E] dark:text-[#E8E6E2]"
          />
          <div className="mt-2 flex items-center justify-end gap-1.5">
            <button
              onClick={() => setMode(null)}
              disabled={isPending}
              className="text-[10px] font-medium text-[#A09E98] border border-black/[.10] dark:border-white/[.10] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] disabled:opacity-50 rounded-md px-2.5 py-1 transition"
            >
              {t("cancelAction")}
            </button>
            <button
              onClick={submitCobrar}
              disabled={isPending}
              className="text-[10px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-50 rounded-md px-2.5 py-1 transition"
            >
              {isPending ? t("saving") : t("confirmCharge")}
            </button>
          </div>
        </div>
      )}

      {mode === "dispensar" && (
        <div className="mt-2 rounded-md bg-[#FAFAF8] dark:bg-white/[.03] border border-black/[.06] dark:border-white/[.06] p-3">
          <label className="block text-[10px] text-[#6B6A66] dark:text-[#9E9C97] mb-1">{t("waiveReasonOptional")}</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full text-[12px] rounded-md border border-black/[.12] dark:border-white/[.12] bg-white dark:bg-[#111827] px-2 py-1 text-[#0F1A2E] dark:text-[#E8E6E2]"
          />
          <div className="mt-2 flex items-center justify-end gap-1.5">
            <button
              onClick={() => setMode(null)}
              disabled={isPending}
              className="text-[10px] font-medium text-[#A09E98] border border-black/[.10] dark:border-white/[.10] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] disabled:opacity-50 rounded-md px-2.5 py-1 transition"
            >
              {t("cancelAction")}
            </button>
            <button
              onClick={submitDispensar}
              disabled={isPending}
              className="text-[10px] font-medium text-[#6B6A66] dark:text-[#9E9C97] border border-black/[.10] dark:border-white/[.10] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] disabled:opacity-50 rounded-md px-2.5 py-1 transition"
            >
              {isPending ? t("saving") : t("confirmWaive")}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-[9px] text-rose-500 mt-1 text-right">{error}</p>}
    </div>
  );
}

function DecidedRow({ row, locale }: { row: FeeDecisionRow; locale: string }) {
  const t = useTranslations("feeDecisions");
  const triggerLabel = row.trigger_status === "no_show" ? t("triggerNoShow") : t("triggerLateCancel");
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <Link
          href={`/patients/${row.patient_id}`}
          className="text-[12px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] hover:underline truncate"
        >
          {row.patient_name ?? t("unknownPatient")}
        </Link>
        <p className="text-[10px] text-[#A09E98] mt-[2px]">
          {triggerLabel}
          {row.decided_at ? ` · ${new Date(row.decided_at).toLocaleDateString(locale)}` : ""}
          {row.notes ? ` · ${row.notes}` : ""}
        </p>
      </div>
      {row.state === "cobrar" ? (
        <p className="shrink-0 text-[12px] font-semibold text-[#0F6E56]">
          {money(row.amount_cents ?? 0, row.currency, locale)}
        </p>
      ) : (
        <span className="shrink-0 text-[10px] px-[8px] py-[2px] rounded-full bg-[#F4F3EF] text-[#6B6A66]">{t("waivedTag")}</span>
      )}
    </div>
  );
}

export function FeeDecisionsClient({
  pending,
  charged,
  waived,
  locale,
}: {
  pending: FeeDecisionRow[];
  charged: FeeDecisionRow[];
  waived: FeeDecisionRow[];
  locale: string;
}) {
  const t = useTranslations("feeDecisions");
  const [tab, setTab] = useState<"pending" | "charged" | "waived">("pending");

  const tabs = [
    { key: "pending" as const, label: t("tabPending"), count: pending.length },
    { key: "charged" as const, label: t("tabCharged"), count: charged.length },
    { key: "waived" as const, label: t("tabWaived"), count: waived.length },
  ];

  const rows = tab === "pending" ? pending : tab === "charged" ? charged : waived;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`text-[11px] font-medium rounded-full px-3 py-1 transition ${
              tab === tb.key
                ? "bg-[#0B1F3A] text-white dark:bg-white/[.15]"
                : "text-[#6B6A66] dark:text-[#9E9C97] border border-black/[.10] dark:border-white/[.10] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06]"
            }`}
          >
            {tb.label}
            {tb.count > 0 ? ` (${tb.count})` : ""}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-[#111827] border border-black/[.07] dark:border-white/[.07] rounded-[12px] overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-[12px] text-[#A09E98] text-center">
            {tab === "pending" ? t("emptyPending") : t("emptyDecided")}
          </p>
        ) : (
          <div className="divide-y divide-black/[.04] dark:divide-white/[.05]">
            {rows.map((row) =>
              tab === "pending" ? (
                <PendingRow key={row.id} row={row} locale={locale} />
              ) : (
                <DecidedRow key={row.id} row={row} locale={locale} />
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
