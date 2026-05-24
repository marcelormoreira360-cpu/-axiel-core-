import { Shell } from "@/components/shell";
import { ProfissionaisClient } from "@/components/profissionais-client";

export default function ProfissionaisPage() {
  return (
    <Shell>
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">Gestão</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">Equipe</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">Produtividade, receita e NPS por profissional.</p>
      </div>
      <ProfissionaisClient />
    </Shell>
  );
}
