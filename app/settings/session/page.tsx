import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { getCurrentClinic, getClinicSessionConfig } from "@/services/clinic-service";
import { DEFAULT_SESSION_CONFIG } from "@/modules/session/session-config";
import { SessionConfigForm } from "@/components/session-config-form";
import { saveSessionConfigAction } from "./actions";

export default async function SessionSettingsPage() {
  const t = await getTranslations("settings.session");
  const clinic = await getCurrentClinic();
  const config = clinic ? await getClinicSessionConfig(clinic.id) : DEFAULT_SESSION_CONFIG;

  return (
    <Shell>
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">{t("scaleTitle")}</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">{t("title")}</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">{t("subtitle")}</p>
      </div>
      <SessionConfigForm config={config} action={saveSessionConfigAction} />
    </Shell>
  );
}
