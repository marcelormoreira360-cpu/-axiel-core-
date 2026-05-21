import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { getCurrentClinic } from "@/services/clinic-service";
import {
  getRepasseRules,
  getRepasseHistory,
  getClinicProfessionals,
} from "@/services/repasse-service";
import { RepasseClient } from "./repasse-client";
import { redirect } from "next/navigation";

export default async function RepassePage() {
  const clinic = await getCurrentClinic();
  if (!clinic) redirect("/dashboard");

  const [rules, history, professionals] = await Promise.all([
    getRepasseRules(clinic.id),
    getRepasseHistory(clinic.id),
    getClinicProfessionals(clinic.id),
  ]);

  return (
    <Shell>
      <div className="mb-7">
        <Link
          href="/financeiro"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Financeiro
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">Financeiro</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">Repasse de colaboradores</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px] max-w-xl">
          Configure o percentual de repasse para cada profissional. O cálculo mensal é feito com base nos pagamentos recebidos no mês.
        </p>
      </div>

      <RepasseClient
        rules={rules}
        history={history}
        professionals={professionals}
      />
    </Shell>
  );
}
