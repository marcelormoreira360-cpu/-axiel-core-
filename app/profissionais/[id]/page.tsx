import { Shell } from "@/components/shell";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { ProfissionalReportClient } from "@/components/profissional-report-client";

export default async function ProfissionalReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Shell>
      <div className="mb-5">
        <Link
          href="/profissionais"
          className="flex items-center gap-1 text-[12px] text-black/40 hover:text-[#0F1A2E] transition mb-4"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Voltar à equipe
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">Profissional</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">Relatório de Produtividade</h1>
      </div>

      <ProfissionalReportClient professionalId={id} />
    </Shell>
  );
}
