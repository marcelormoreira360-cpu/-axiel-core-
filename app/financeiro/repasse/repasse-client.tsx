"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatBRL } from "@/lib/finance-utils";
import type { RepasseRule, RepasseEntry, ClinicProfessional } from "@/services/repasse-service";
import {
  saveRepasseRuleAction,
  deleteRepasseRuleAction,
  calculateRepasseAction,
  markRepassePaidAction,
} from "./actions";

interface Props {
  rules: RepasseRule[];
  history: RepasseEntry[];
  professionals: ClinicProfessional[];
}

export function RepasseClient({ rules, history, professionals }: Props) {
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
      flash("Regra salva.");
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
      flash("Repasse calculado.");
      router.refresh();
    });
  }

  function handleMarkPaid(ledgerId: string) {
    startTransition(async () => {
      const r = await markRepassePaidAction(ledgerId);
      if (r.error) { setError(r.error); return; }
      flash("Marcado como pago.");
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
      <div className="rounded-2xl border border-black/[.07] bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[.05]">
          <div>
            <p className="text-[13px] font-semibold text-[#0F1A2E]">Regras de repasse</p>
            <p className="text-[11px] text-[#A09E98] mt-0.5">Defina o percentual de cada profissional sobre os pagamentos recebidos.</p>
          </div>
        </div>

        {/* Existing rules */}
        {rules.length > 0 && (
          <div className="divide-y divide-black/[.04]">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-[13px] font-medium text-[#0F1A2E]">{rule.professional_name ?? rule.user_id}</p>
                  <p className="text-[11px] text-[#A09E98]">{rule.professional_email ?? ""}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[18px] font-semibold text-[#0F6E56]">{rule.percentage}%</span>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    disabled={isPending}
                    className="text-[11px] text-red-400 hover:text-red-600 transition"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add new rule */}
        {available.length > 0 && (
          <form onSubmit={handleSaveRule} className="px-5 py-4 border-t border-black/[.04] bg-[#FAFAF8]">
            <p className="text-[11px] font-medium text-[#0F1A2E] mb-3">Adicionar profissional</p>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <label className="text-[11px] text-[#A09E98] mb-1 block">Profissional</label>
                <select name="user_id" required className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none">
                  <option value="">Selecione</option>
                  {available.map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name ?? p.email ?? p.id}</option>
                  ))}
                </select>
              </div>
              <div className="w-28">
                <label className="text-[11px] text-[#A09E98] mb-1 block">Percentual (%)</label>
                <input
                  name="percentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  placeholder="60"
                  required
                  className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-[#0B1F3A] px-4 py-2 text-sm font-medium text-white hover:bg-black transition disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </form>
        )}

        {available.length === 0 && rules.length === 0 && (
          <p className="px-5 py-4 text-[12px] text-[#A09E98]">
            Nenhum profissional cadastrado na clínica ainda.
          </p>
        )}
      </div>

      {/* ── Calcular repasse do mês ── */}
      {rules.length > 0 && (
        <div className="rounded-2xl border border-black/[.07] bg-white p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[13px] font-semibold text-[#0F1A2E]">Calcular repasse do mês atual</p>
              <p className="text-[11px] text-[#A09E98] mt-0.5">
                Calcula com base nos pagamentos recebidos em {currentMonth}.
              </p>
            </div>
            <button
              onClick={handleCalculate}
              disabled={isPending}
              className="rounded-lg bg-[#0B1F3A] px-4 py-2 text-sm font-medium text-white hover:bg-black transition disabled:opacity-50"
            >
              {isPending ? "Calculando..." : "Calcular agora"}
            </button>
          </div>
        </div>
      )}

      {/* ── Histórico ── */}
      {history.length > 0 && (
        <div className="rounded-2xl border border-black/[.07] bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-black/[.05]">
            <p className="text-[13px] font-semibold text-[#0F1A2E]">Histórico de repasses</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[.05] bg-[#FAFAF8]">
                  <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">Profissional</th>
                  <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">Mês</th>
                  <th className="px-5 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">Sessões</th>
                  <th className="px-5 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">Receita bruta</th>
                  <th className="px-5 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">Repasse</th>
                  <th className="px-5 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-black/40">Status</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[.04]">
                {history.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#FAFAF8] transition">
                    <td className="px-5 py-3 text-[12px] font-medium text-[#0F1A2E]">{entry.professional_name ?? "—"}</td>
                    <td className="px-5 py-3 text-[12px] text-[#6B6A66]">{entry.period_month}</td>
                    <td className="px-5 py-3 text-[12px] text-right text-[#0F1A2E]">{entry.sessions_count}</td>
                    <td className="px-5 py-3 text-[12px] text-right text-[#0F1A2E]">{formatBRL(entry.gross_revenue_cents)}</td>
                    <td className="px-5 py-3 text-[13px] font-semibold text-right text-[#0F6E56]">{formatBRL(entry.repasse_cents)}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                        entry.status === "paid"
                          ? "bg-[#E1F5EE] text-[#0F6E56]"
                          : "bg-amber-50 text-amber-600"
                      }`}>
                        {entry.status === "paid" ? "Pago" : "Pendente"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {entry.status === "pending" && (
                        <button
                          onClick={() => handleMarkPaid(entry.id)}
                          disabled={isPending}
                          className="text-[11px] font-medium text-[#0F6E56] hover:underline disabled:opacity-50"
                        >
                          Marcar pago
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
