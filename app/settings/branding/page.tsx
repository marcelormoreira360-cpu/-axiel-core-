import { Shell } from "@/components/shell";
import { BrandingForm } from "./branding-form";
import { getCurrentClinic } from "@/services/clinic-service";

export default async function BrandingSettingsPage() {
  const clinic = await getCurrentClinic();

  return (
    <Shell>
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-black/35">Settings</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Identidade visual</h1>
        <p className="mt-3 max-w-2xl text-lg text-black/55">
          Personalize o logo e a cor da sua clínica no portal do paciente e na página de agendamento.
        </p>
      </div>
      <BrandingForm
        currentLogoUrl={clinic?.logo_url ?? null}
        currentPrimaryColor={clinic?.primary_color ?? null}
      />
    </Shell>
  );
}
