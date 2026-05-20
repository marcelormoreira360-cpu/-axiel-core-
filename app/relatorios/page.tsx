import { Shell } from "@/components/shell";
import { RelatoriosClient } from "./relatorios-client";

export default function RelatoriosPage() {
  return (
    <Shell>
      <div className="mb-7">
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">Clínica</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">Relatórios</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">
          Exporte dados financeiros, de pacientes e sessões em PDF ou planilha.
        </p>
      </div>
      <RelatoriosClient />
    </Shell>
  );
}
