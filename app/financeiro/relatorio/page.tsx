import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { FinanceReportClient } from "@/components/finance-report-client";

export default function FinanceReportPage() {
  return (
    <Shell>
      <div className="mb-5">
        <Link
          href="/financeiro"
          className="flex items-center gap-1 text-[12px] text-black/40 hover:text-[#0F1A2E] transition mb-4"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Voltar ao financeiro
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">Financeiro</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">Relatório</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">Receita por período, tipo de sessão e pacientes.</p>
      </div>

      <FinanceReportClient />
    </Shell>
  );
}
