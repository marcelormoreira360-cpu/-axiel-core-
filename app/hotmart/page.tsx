import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { Shell } from "@/components/shell";
import { getCurrentClinic } from "@/services/clinic-service";
import { getHotmartKPIs, listHotmartPurchases } from "@/services/hotmart-service";
import { HotmartClient } from "./hotmart-client";

export default async function HotmartPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string; to?: string; search?: string; page?: string }>;
}) {
  const clinic = await getCurrentClinic();
  if (!clinic) redirect("/dashboard");

  const sp     = await searchParams;
  const status = sp.status ?? "all";
  const from   = sp.from   ?? "";
  const to     = sp.to     ?? "";
  const search = sp.search ?? "";
  const page   = Math.max(1, parseInt(sp.page ?? "1", 10));
  const limit  = 50;
  const offset = (page - 1) * limit;

  const [kpis, { purchases, total }] = await Promise.all([
    getHotmartKPIs(clinic.id),
    listHotmartPurchases(clinic.id, { status: status !== "all" ? status : undefined, from: from || undefined, to: to || undefined, search: search || undefined, limit, offset }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <Shell>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">Hotmart</h1>
          <p className="text-[12px] text-[#A09E98] mt-[2px]">Compras e assinaturas sincronizadas automaticamente</p>
        </div>
        <Link
          href="/settings/integrations/hotmart"
          className="flex items-center gap-[6px] text-[12px] font-medium text-[#6B6A66] border border-black/[.10] hover:bg-[#F4F3EF] transition rounded-[8px] px-[12px] py-[7px]"
        >
          <Settings className="h-3.5 w-3.5" />
          Configurar
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-black/[.07] rounded-[12px] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#A09E98]">Receita total</p>
          <p className="text-[22px] font-semibold text-[#0F1A2E] mt-1">
            {(kpis.total_revenue_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
          <p className="text-[11px] text-[#A09E98] mt-0.5">compras confirmadas</p>
        </div>
        <div className="bg-white border border-black/[.07] rounded-[12px] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#A09E98]">Total de compras</p>
          <p className="text-[22px] font-semibold text-[#0F1A2E] mt-1">{kpis.total_purchases}</p>
          <p className="text-[11px] text-[#A09E98] mt-0.5">{kpis.completed} confirmadas</p>
        </div>
        <div className="bg-white border border-black/[.07] rounded-[12px] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#A09E98]">Canceladas</p>
          <p className="text-[22px] font-semibold text-[#0F1A2E] mt-1">{kpis.cancelled}</p>
          <p className="text-[11px] text-[#A09E98] mt-0.5">+ {kpis.refunded} reembolsadas</p>
        </div>
        <div className="bg-white border border-black/[.07] rounded-[12px] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#A09E98]">Chargebacks</p>
          <p className="text-[22px] font-semibold text-red-500 mt-1">{kpis.chargeback}</p>
          <p className="text-[11px] text-[#A09E98] mt-0.5">contestações</p>
        </div>
      </div>

      {/* Table + filters */}
      <HotmartClient
        purchases={purchases}
        total={total}
        page={page}
        totalPages={totalPages}
        defaultStatus={status}
        defaultFrom={from}
        defaultTo={to}
        defaultSearch={search}
      />
    </Shell>
  );
}
