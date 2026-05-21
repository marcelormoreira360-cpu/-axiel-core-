import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { BrandingForm } from "./branding-form";
import { getCurrentClinic } from "@/services/clinic-service";

export default async function BrandingSettingsPage() {
  const clinic = await getCurrentClinic();

  return (
    <Shell>
      <div className="mb-7">
        <Link href="/settings" className="mb-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition">
          <ArrowLeft className="h-3.5 w-3.5" /> Configurações
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">Configurações</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">Identidade visual</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">
          Personalize o logo e a cor da sua clínica no portal do paciente e na página de agendamento.
        </p>
      </div>
      <BrandingForm
        currentLogoUrl={clinic?.logo_url ?? null}
        currentPrimaryColor={clinic?.primary_color ?? null}
        clinicId={clinic?.id ?? ""}
      />
    </Shell>
  );
}
