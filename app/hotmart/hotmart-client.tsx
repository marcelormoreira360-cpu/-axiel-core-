"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import type { HotmartPurchaseFull } from "@/services/hotmart-service";

const STATUS_TABS = [
  { key: "all",        label: "Todos" },
  { key: "completed",  label: "Confirmadas" },
  { key: "cancelled",  label: "Canceladas" },
  { key: "refunded",   label: "Reembolsadas" },
  { key: "chargeback", label: "Chargebacks" },
];

const STATUS_STYLES: Record<string, string> = {
  completed:  "bg-[#E1F5EE] text-[#0F6E56]",
  cancelled:  "bg-red-50 text-red-500",
  refunded:   "bg-amber-50 text-amber-600",
  chargeback: "bg-red-100 text-red-600",
  other:      "bg-[#F4F3EF] text-[#6B6A66]",
};

const STATUS_LABELS: Record<string, string> = {
  completed:  "Confirmada",
  cancelled:  "Cancelada",
  refunded:   "Reembolsada",
  chargeback: "Chargeback",
  other:      "Outro",
};

function formatBRL(cents: number | null) {
  if (!cents) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Props {
  purchases: HotmartPurchaseFull[];
  total: number;
  page: number;
  totalPages: number;
  defaultStatus: string;
  defaultFrom: string;
  defaultTo: string;
  defaultSearch: string;
}

export function HotmartClient({
  purchases,
  total,
  page,
  totalPages,
  defaultStatus,
  defaultFrom,
  defaultTo,
  defaultSearch,
}: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const sp       = useSearchParams();
  const [, startTransition] = useTransition();

  const push = useCallback(
    (params: Record<string, string>) => {
      const next = new URLSearchParams(sp.toString());
      Object.entries(params).forEach(([k, v]) => {
        if (v) next.set(k, v); else next.delete(k);
      });
      next.delete("page"); // reset pagination on filter change
      startTransition(() => router.push(`${pathname}?${next.toString()}`));
    },
    [router, pathname, sp],
  );

  return (
    <div className="space-y-4">
      {/* ── Filters ── */}
      <div className="bg-white border border-black/[.07] rounded-[12px] p-4 space-y-3">
        {/* Status tabs */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => push({ status: t.key })}
              className={`rounded-[6px] px-3 py-1.5 text-[12px] font-medium transition ${
                defaultStatus === t.key
                  ? "bg-[#0F1A2E] text-white"
                  : "text-[#6B6A66] hover:bg-[#F4F3EF]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search + date range */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#A09E98]" />
            <input
              type="text"
              placeholder="Buscar por nome, e-mail ou produto..."
              defaultValue={defaultSearch}
              onKeyDown={(e) => { if (e.key === "Enter") push({ search: (e.target as HTMLInputElement).value }); }}
              onBlur={(e) => push({ search: e.target.value })}
              className="w-full rounded-[8px] border border-black/15 pl-9 pr-3 py-1.5 text-[12px] focus:outline-none focus:border-[#0F1A2E]/30"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-[#6B6A66]">De</label>
            <input
              type="date"
              defaultValue={defaultFrom}
              onBlur={(e) => push({ from: e.target.value })}
              className="rounded-[8px] border border-black/15 px-3 py-1.5 text-[12px] focus:outline-none focus:border-[#0F1A2E]/30"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-[#6B6A66]">Até</label>
            <input
              type="date"
              defaultValue={defaultTo}
              onBlur={(e) => push({ to: e.target.value })}
              className="rounded-[8px] border border-black/15 px-3 py-1.5 text-[12px] focus:outline-none focus:border-[#0F1A2E]/30"
            />
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-[12px] border border-black/[.07] bg-white">
        {purchases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-[14px] font-medium text-[#0F1A2E]">Nenhuma compra encontrada</p>
            <p className="text-[12px] text-[#A09E98] mt-1">
              Configure o webhook da Hotmart em{" "}
              <Link href="/settings/integrations/hotmart" className="underline">Configurações</Link>
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[.06] bg-[#FAFAF8]">
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">Comprador</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">Produto</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">Valor</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">Status</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">Data</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">Paciente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[.04]">
                  {purchases.map((p) => {
                    const patientName = p.patients
                      ? (Array.isArray(p.patients) ? (p.patients[0] as { full_name: string })?.full_name : (p.patients as { full_name: string }).full_name)
                      : null;

                    return (
                      <tr key={p.id} className="hover:bg-[#FAFAF8] transition">
                        <td className="px-4 py-3">
                          <p className="font-medium text-[13px] text-[#0F1A2E]">{p.buyer_name || "—"}</p>
                          <p className="text-[11px] text-black/40">{p.buyer_email}</p>
                          {p.buyer_phone && (
                            <p className="text-[11px] text-black/30">{p.buyer_phone}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[#0F1A2E] max-w-[180px]">
                          <p className="truncate">{p.product_name || "—"}</p>
                          {p.event_type && (
                            <p className="text-[10px] text-black/30 mt-0.5">{p.event_type}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-[13px] text-[#0F1A2E] whitespace-nowrap">
                          {formatBRL(p.price_cents)}
                          {p.currency && p.currency !== "BRL" && (
                            <span className="text-[10px] text-black/30 ml-1">{p.currency}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLES[p.status] ?? STATUS_STYLES.other}`}>
                            {STATUS_LABELS[p.status] ?? p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-black/40 whitespace-nowrap">
                          {new Date(p.created_at).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-4 py-3">
                          {p.patient_id ? (
                            <Link
                              href={`/patients/${p.patient_id}`}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0F6E56] hover:underline"
                            >
                              {patientName ?? "Ver perfil"}
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : (
                            <span className="text-[11px] text-black/30">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-black/[.06] px-4 py-3">
                <p className="text-[11px] text-[#A09E98]">
                  {total} compras · página {page} de {totalPages}
                </p>
                <div className="flex gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => {
                      const next = new URLSearchParams(sp.toString());
                      next.set("page", String(page - 1));
                      startTransition(() => router.push(`${pathname}?${next.toString()}`));
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-black/[.08] text-[#6B6A66] disabled:opacity-30 hover:bg-[#F4F3EF] transition"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => {
                      const next = new URLSearchParams(sp.toString());
                      next.set("page", String(page + 1));
                      startTransition(() => router.push(`${pathname}?${next.toString()}`));
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-black/[.08] text-[#6B6A66] disabled:opacity-30 hover:bg-[#F4F3EF] transition"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
