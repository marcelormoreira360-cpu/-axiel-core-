import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { Card } from "@/components/card";
import { BackLink } from "@/components/back-link";
import { getCurrentClinic } from "@/services/clinic-service";
import { getWhatsAppBotConfig } from "@/services/whatsapp-bot-service";
import {
  getFacebookPageStatus,
  getInstagramStatus,
  type ChannelConnectionState,
} from "@/lib/meta-channel-status";

// Estado da conexão sempre resolvido em tempo real (Graph API) — sem cache de rota.
export const dynamic = "force-dynamic";

type Tone = "green" | "amber" | "gray";

function toneFor(state: ChannelConnectionState): Tone {
  if (state === "connected") return "green";
  if (state === "configured") return "amber";
  return "gray";
}

function StatusPill({ tone, label }: { tone: Tone; label: string }) {
  const styles: Record<Tone, string> = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    gray: "bg-black/5 text-black/45",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${styles[tone]}`}>
      {label}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-[13px] text-black/45">{label}</span>
      <span className="text-[13px] font-medium text-[#0F1A2E] text-right break-all">{value}</span>
    </div>
  );
}

export default async function ChannelsSettingsPage() {
  const t = await getTranslations("settings.channels");
  const clinic = await getCurrentClinic();
  const config = clinic ? await getWhatsAppBotConfig(clinic.id) : null;

  const fbPageId = config?.meta_facebook_page_id ?? null;
  const igId = config?.meta_instagram_id ?? null;
  const waPhoneId = config?.meta_phone_number_id ?? null;

  const [fb, ig] = await Promise.all([
    fbPageId ? getFacebookPageStatus(fbPageId) : Promise.resolve(null),
    igId ? getInstagramStatus(igId) : Promise.resolve(null),
  ]);

  const statusLabel = (state: ChannelConnectionState) =>
    state === "connected"
      ? t("statusConnected")
      : state === "configured"
        ? t("statusConfigured")
        : t("statusNotConnected");

  const hasAny = Boolean(fbPageId || igId || waPhoneId);

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

      {!hasAny ? (
        <Card className="p-6">
          <p className="text-sm text-black/55">{t("empty")}</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {fbPageId && (
            <Card className="p-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-semibold text-[#0F1A2E]">{t("facebookTitle")}</h2>
                <StatusPill tone={toneFor(fb?.state ?? "configured")} label={statusLabel(fb?.state ?? "configured")} />
              </div>
              <div className="divide-y divide-black/[.06]">
                {fb?.name && <Row label={t("labelName")} value={fb.name} />}
                <Row label={t("labelPageId")} value={fbPageId} />
                <Row
                  label={t("labelWebhook")}
                  value={fb?.subscribedMessages ? t("webhookSubscribed") : t("webhookNotSubscribed")}
                />
              </div>
            </Card>
          )}

          {igId && (
            <Card className="p-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-semibold text-[#0F1A2E]">{t("instagramTitle")}</h2>
                <StatusPill tone={toneFor(ig?.state ?? "configured")} label={statusLabel(ig?.state ?? "configured")} />
              </div>
              <div className="divide-y divide-black/[.06]">
                {ig?.username && <Row label={t("labelAccount")} value={`@${ig.username}`} />}
                <Row label={t("labelAccountId")} value={igId} />
                <Row
                  label={t("labelWebhook")}
                  value={ig?.subscribedMessages ? t("webhookSubscribed") : t("webhookNotSubscribed")}
                />
              </div>
            </Card>
          )}

          {waPhoneId && (
            <Card className="p-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-semibold text-[#0F1A2E]">{t("whatsappTitle")}</h2>
                <StatusPill tone="green" label={t("statusConnected")} />
              </div>
              <div className="divide-y divide-black/[.06]">
                {config?.twilio_number && <Row label={t("labelNumber")} value={config.twilio_number} />}
                <Row label={t("labelPhoneNumberId")} value={waPhoneId} />
              </div>
            </Card>
          )}
        </div>
      )}

      <p className="mt-5 text-[11px] text-black/35">{t("readOnlyNote")}</p>
    </Shell>
  );
}
