import { Shell } from "@/components/shell";
import { Package } from "lucide-react";

export default function ProductsPage() {
  return (
    <Shell>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-14 h-14 rounded-2xl bg-[#F4F3EF] flex items-center justify-center mb-5">
          <Package className="h-7 w-7 text-[#A09E98]" />
        </div>
        <h1 className="text-[22px] font-semibold text-[#0F1A2E] tracking-[-0.025em] mb-2">
          Módulo de produtos
        </h1>
        <p className="text-[14px] text-[#6B6A66] max-w-sm leading-relaxed">
          Gerencie suplementos, kits e itens de suporte prescritos para seus pacientes.
          Este módulo estará disponível em breve.
        </p>
        <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#FEF3C7] px-3 py-1 text-[11px] font-semibold text-amber-700">
          Em breve
        </span>
      </div>
    </Shell>
  );
}
