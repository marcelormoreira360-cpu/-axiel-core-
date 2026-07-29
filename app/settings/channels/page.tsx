import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { getCurrentClinic } from "@/services/clinic-service";
import { getWhatsAppBotConfig } from "@/services/whatsapp-bot-service";
import { ChannelsPanel } from "./channels-panel";

// Só resolve config da clínica (Supabase, rápido) no servidor. O status ao vivo
// dos canais Meta é buscado no cliente (ver channels-panel.tsx), para que a
// Graph API nunca segure o render RSC nem estoure o maxDuration da função.
export const dynamic = "force-dynamic";

export default async function ChannelsSettingsPage() {
  const t = await getTranslations("settings.channels");
  const clinic = await getCurrentClinic();
  const config = clinic ? await getWhatsAppBotConfig(clinic.id) : null;

  return (
    <Shell>
      <div className="mb-7">
        <BackLink
          fallbackHref="/settings"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t("back")}
        </BackLink>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">{t("eyebrow")}</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">{t("title")}</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">{t("subtitle")}</p>
      </div>

      <ChannelsPanel
        fbPageId={config?.meta_facebook_page_id ?? null}
        igId={config?.meta_instagram_id ?? null}
        waPhoneId={config?.meta_phone_number_id ?? null}
        twilioNumber={config?.twilio_number ?? null}
      />

      <p className="mt-5 text-[11px] text-black/35">{t("readOnlyNote")}</p>
    </Shell>
  );
}
