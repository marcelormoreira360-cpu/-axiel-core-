"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { RepasseRule, RepasseEntry, ClinicProfessional } from "@/services/repasse-service";
import {
  saveRepasseRuleAction,
  deleteRepasseRuleAction,
  calculateRepasseAction,
  markRepassePaidAction,
} from "./actions";
import { useFormatMoney } from "@/components/currency-provider";

interface Props {
  rules: RepasseRule[];
  history: RepasseEntry[];
  professionals: ClinicProfessional[];
}

export function RepasseClient({ rules, history, professionals }: Props) {
  const money = useFormatMoney();
  const t = useTranslations("finance.repasse");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentMonth = new Date().toISOString().slice(0, 7);

  function flash(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  }

  function handleSaveRule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await saveRepasseRuleAction(fd);
      if (r.error) { setError(r.error); return; }
      flash(t("flashRuleSaved"));
      router.refresh();
    });
  }

  function handleDelete(ruleId: string) {
    startTransition(async () => {
      await deleteRepasseRuleAction(ruleId);
      router.refresh();
    });
  }

  function handleCalculate() {
    startTransition(async () => {
      const r = await calculateRepasseAction(currentMonth);
      if (r.error) { setError(r.error); return; }
      flash(t("flashCalculated"));
      router.refresh();
    });
  }

  function handleMarkPaid(ledgerId: string) {
    startTransition(async () => {
      const r = await markRepassePaidAction(ledgerId);
      if (r.error) { setError(r.error); return; }
      flash(t("flashMarkedPaid"));
      router.refresh();
    });
  }

  // Available professionals not yet in a rule
  const ruleUserIds = new Set(rules.map((r) => r.user_id));
  const available = professionals.filter((p) => !ruleUserIds.has(p.id));

  return (
    <div className="space-y-6">
      {(error || success) && (
        <div className={`rounded-lg px-4 py-3 text-sm ${error ? "bg-red-50 text-red-600" : "bg-[#E1F5EE] text-[#0F6E56]"}`}>
          {error ?? success}
        </div>
      )}

      {/* ── Regras de repasse ── */}
      <div className="rounded-2xl border border-black/[.07] dark:border-white/[.07] bg-white dark:bg-[#111827] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[.05] dark:border-white/[.05]">
          <div>
            <p className="text-[13px] font-semibold text-[#0F1A2E] dark:text-[#E8E6E2]">{t("rulesTitle")}</p>
            <p className="text-[11px] text-[#A09E98] mt-0.5">{t("rulesDesc")}</p>
          </div>
        </div>

        {/* Existing rules */}
        {rules.length > 0 && (
          <div className="divide-y divide-black/[.04] dark:divide-white/[.05]">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-[13px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">{rule.professional_name ?? rule.user_id}</p>
                  <p className="text-[11px] text-[#A09E98]">{rule.professional_email ?? ""}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[18px] font-semibold text-[#0F6E56]">{rule.percentage}%</span>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    disabled={isPending}
                    className="text-[11px] text-red-400 hover:text-red-600 transition"
                  >
                    {t("remove")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add new rule */}
        {available.length > 0 && (
          <form onSubmit={handleSaveRule} className="px-5 py-4 border-t border-black/[.04] dark:border-white/[.04] bg-[#FAFAF8] dark:bg-white/[.03]">
            <p className="text-[11px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] mb-3">{t("addPro")}</p>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <label className="text-[11px] text-[#A09E98] mb-1 block">{t("professional")}</label>
                <select name="user_id" required className="w-full rounded-lg border border-black/15 dark:border-white/15 dark:bg-transparent dark:text-[#E8E6E2] px-3 py-2 text-sm focus:outline-none">
                  <option value="">{t("select")}</option>
                  {available.map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name ?? p.email ?? p.id}</option>
                  ))}
                </select>
              </div>
              <div className="w-28">
                <label className="text-[11px] text-[#A09E98] mb-1 block">{t("percentage")}</label>
                <input
                  name="percentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  placeholder="60"
                  required
                  className="w-full rounded-lg border border-black/15 dark:border-white/15 dark:bg-transparent dark:text-[#E8E6E2] px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-[#0B1F3A] dark:bg-white/[.10] px-4 py-2 text-sm font-medium text-white hover:bg-black dark:hover:bg-white/[.16] transition disabled:opacity-50"
              >
                {t("save")}
              </button>
            </div>
          </form>
        )}

        {available.length === 0 && rules.length === 0 && (
          <p className="px-5 py-4 text-[12px] text-[#A09E98]">
            {t("noPros")}
          </p>
        )}
      </div>

      {/* ── Calcular repasse do mês ── */}
      {rules.length > 0 && (
        <div className="rounded-2xl border border-black/[.07] dark:border-white/[.07] bg-white dark:bg-[#111827] p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[13px] font-semibold text-[#0F1A2E] dark:text-[#E8E6E2]">{t("calcTitle")}</p>
              <p className="text-[11px] text-[#A09E98] mt-0.5">
                {t("calcDesc", { month: currentMonth })}
              </p>
            </div>
            <button
              onClick={handleCalculate}
              disabled={isPending}
              className="rounded-lg bg-[#0B1F3A] dark:bg-white/[.10] px-4 py-2 text-sm font-medium text-white hover:bg-black dark:hover:bg-white/[.16] transition disabled:opacity-50"
            >
              {isPending ? t("calculating") : t("calcNow")}
            </button>
          </div>
        </div>
      )}

      {/* ── Histórico ── */}
      {history.length > 0 && (
        <div className="rounded-2xl border border-black/[.07] dark:border-white/[.07] bg-white dark:bg-[#111827] overflow-hidden">
          <div className="px-5 py-4 border-b border-black/[.05] dark:border-white/[.05]">
            <p className="text-[13px] font-semibold text-[#0F1A2E] dark:text-[#E8E6E2]">{t("historyTitle")}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[.05] dark:border-white/[.05] bg-[#FAFAF8] dark:bg-white/[.03]">
                  <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40 dark:text-white/40">{t("colPro")}</th>
                  <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40 dark:text-white/40">{t("colMonth")}</th>
                  <th className="px-5 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40 dark:text-white/40">{t("colSessions")}</th>
                  <th className="px-5 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40 dark:text-white/40">{t("colGross")}</th>
                  <th className="px-5 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40 dark:text-white/40">{t("colRepasse")}</th>
                  <th className="px-5 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-black/40 dark:text-white/40">{t("colStatus")}</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[.04] dark:divide-white/[.05]">
                {history.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#FAFAF8] dark:hover:bg-white/[.03] transition">
                    <td className="px-5 py-3 text-[12px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">{entry.professional_name ?? "—"}</td>
                    <td className="px-5 py-3 text-[12px] text-[#6B6A66] dark:text-[#9E9C97]">{entry.period_month}</td>
                    <td className="px-5 py-3 text-[12px] text-right text-[#0F1A2E] dark:text-[#E8E6E2]">{entry.sessions_count}</td>
                    <td className="px-5 py-3 text-[12px] text-right text-[#0F1A2E] dark:text-[#E8E6E2]">{money(entry.gross_revenue_cents)}</td>
                    <td className="px-5 py-3 text-[13px] font-semibold text-right text-[#0F6E56]">{money(entry.repasse_cents)}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                        entry.status === "paid"
                          ? "bg-[#E1F5EE] text-[#0F6E56]"
                          : "bg-amber-50 text-amber-600"
                      }`}>
                        {entry.status === "paid" ? t("paid") : t("pending")}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {entry.status === "pending" && (
                        <button
                          onClick={() => handleMarkPaid(entry.id)}
                          disabled={isPending}
                          className="text-[11px] font-medium text-[#0F6E56] hover:underline disabled:opacity-50"
                        >
                          {t("markPaid")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
