import Link from "next/link";
import { Shell } from "@/components/shell";
import { Package, ArrowLeft } from "lucide-react";

export default async function PatientProductsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Shell>
      <div className="flex items-center gap-[10px] mb-[24px]">
        <Link
          href={`/patients/${id}`}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
        <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">Suporte de produtos</h1>
      </div>

      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="w-14 h-14 rounded-2xl bg-[#F4F3EF] flex items-center justify-center mb-5">
          <Package className="h-7 w-7 text-[#A09E98]" />
        </div>
        <h2 className="text-[18px] font-semibold text-[#0F1A2E] tracking-[-0.02em] mb-2">
          Produtos do paciente
        </h2>
        <p className="text-[13px] text-[#6B6A66] max-w-xs leading-relaxed">
          Suplementos e itens de suporte prescritos para este paciente aparecerão aqui.
          Funcionalidade em desenvolvimento.
        </p>
        <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#FEF3C7] px-3 py-1 text-[11px] font-semibold text-amber-700">
          Em breve
        </span>
      </div>
    </Shell>
  );
}
