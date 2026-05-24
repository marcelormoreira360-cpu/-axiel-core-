import { Shell } from "@/components/shell";
import { AssinaturasClient } from "@/components/assinaturas-client";

export default function AssinaturasPage() {
  return (
    <Shell>
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">Clínica</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">Assinaturas</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">
          Planos recorrentes ativos e histórico de cobranças por paciente.
        </p>
      </div>
      <AssinaturasClient />
    </Shell>
  );
}
