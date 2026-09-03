import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { getCurrentUserProfile } from "@/services/user-service";
import {
  listConversations,
  getWaStats,
  getLastMessage,
  formatPhone,
  type WaConversation,
} from "@/services/whatsapp-conversation-service";
import { handoffStatus, type HandoffStatus } from "@/lib/whatsapp-handoff";
import { conversationChannel, type ConversationChannel } from "@/lib/twilio-webhook-utils";
import { ConversationsList, type ConvRowData } from "./conversations-list";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

function timeAgo(iso: string, t: Translator): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("page.timeAgo.now");
  if (mins < 60) return t("page.timeAgo.minutes", { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("page.timeAgo.hours", { count: hrs });
  return t("page.timeAgo.days", { count: Math.floor(hrs / 24) });
}

/** Rótulo curto quando a última mensagem é só mídia (sem texto). */
function mediaGlyph(kind: string | undefined): string {
  if (kind === "image") return "🖼 imagem";
  if (kind === "audio") return "🎤 áudio";
  if (kind === "file") return "📎 arquivo";
  return "";
}

export default async function WhatsAppMonitorPage() {
  const [profile, t] = await Promise.all([
    getCurrentUserProfile(),
    getTranslations("whatsapp"),
  ]);
  const clinicId = profile?.clinic_id ?? undefined;

  let convs: WaConversation[] = [];
  let stats = { total: 0, newToday: 0, messagesToday: 0, botActive: false };
  let serviceError: string | null = null;

  try {
    [convs, stats] = await Promise.all([
      listConversations(clinicId),
      getWaStats(clinicId),
    ]);
  } catch (err) {
    serviceError = err instanceof Error ? err.message : t("page.loadError");
  }

  const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://oxielcore.com"}/api/whatsapp/webhook`;
  const fromNumber = process.env.TWILIO_FROM_NUMBER ?? "-";

  const statusLabels: Record<HandoffStatus, string> = {
    active: t("handoff.status.active"),
    paused: t("handoff.status.paused"),
    with_team: t("handoff.status.withTeam"),
  };
  const channelLabels: Record<ConversationChannel, string> = {
    whatsapp: t("channel.whatsapp"),
    messenger: t("channel.messenger"),
    instagram: t("channel.instagram"),
    sms: t("channel.sms"),
  };
  const statusOf = (c: WaConversation) =>
    handoffStatus({
      aiPaused: c.ai_paused,
      botDisabled: c.bot_disabled,
      lastHumanMessageAt: c.last_human_message_at,
    });

  const humanConvs = convs.filter((c) => statusOf(c) !== "active");
  const botConvs = convs.filter((c) => statusOf(c) === "active");

  // Linhas serializáveis para a lista com busca (client component).
  const rows: ConvRowData[] = convs.map((conv) => {
    const status = statusOf(conv);
    const last = getLastMessage(conv);
    const channel = conversationChannel(conv.phone);
    const phoneFormatted = formatPhone(conv.phone);
    let lastText = "";
    let lastPrefix: "→" | "←" | "" = "";
    if (last) {
      lastPrefix = last.role === "user" ? "→" : "←";
      lastText = last.content.replace(/\[MANUAL\]\s?/, "").trim();
      if (!lastText && last.media) lastText = mediaGlyph(last.media.kind);
    }
    return {
      id: conv.id,
      url: `/whatsapp/${encodeURIComponent(conv.phone)}`,
      phoneFormatted,
      channelLabel: channelLabels[channel],
      status,
      statusLabel: status !== "active" ? statusLabels[status] : null,
      isPatient: !!conv.linked_patient_id,
      avatar: conv.phone.replace(/\D/g, "").slice(-2),
      lastPrefix,
      lastText,
      timeAgo: timeAgo(conv.updated_at, t),
      msgCount: t("page.msgCount", { count: conv.messages.length }),
      search: `${phoneFormatted} ${conv.phone} ${channelLabels[channel]} ${lastText}`.toLowerCase(),
    };
  });

  return (
    <Shell>
      {/* Header */}
      <div className="flex items-start justify-between mb-[20px]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#A09E98] mb-[2px]">
            {t("page.eyebrow")}
          </p>
          <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">
            {t("page.title")}
          </h1>
          <p className="text-[12px] text-[#A09E98] mt-[2px]">
            {t("page.subtitle")}
          </p>
        </div>
        <Link
          href="/settings/whatsapp"
          className="flex items-center gap-[6px] text-[12px] font-medium text-[#0F1A2E] border border-black/[.10] hover:bg-[#F4F3EF] transition px-[12px] py-[7px] rounded-[8px]"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          {t("page.configure")}
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px] mb-[16px]">
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[13px]">
          <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[6px]">{t("page.kpiBot")}</p>
          <div className="flex items-center gap-[6px]">
            <span className={`w-2 h-2 rounded-full shrink-0 ${stats.botActive ? "bg-[#0F6E56]" : "bg-[#D3D1C7]"}`} />
            <p className={`text-[18px] font-semibold leading-none ${stats.botActive ? "text-[#0F6E56]" : "text-[#A09E98]"}`}>
              {stats.botActive ? t("page.botActive") : t("page.botInactive")}
            </p>
          </div>
          <p className="text-[10px] text-[#A09E98] mt-[4px]">{t("page.botVia")}</p>
        </div>

        <div className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[13px]">
          <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[6px]">{t("page.kpiConversations")}</p>
          <p className="text-[22px] font-semibold tracking-[-0.03em] leading-none text-[#0F1A2E]">{stats.total}</p>
          <p className="text-[10px] text-[#A09E98] mt-[4px]">
            {stats.newToday > 0 ? t("page.newToday", { count: stats.newToday }) : t("page.noneToday")}
          </p>
        </div>

        <div className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[13px]">
          <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[6px]">{t("page.kpiMessages")}</p>
          <p className="text-[22px] font-semibold tracking-[-0.03em] leading-none text-[#0F1A2E]">{stats.messagesToday}</p>
          <p className="text-[10px] text-[#A09E98] mt-[4px]">{t("page.messagesSub")}</p>
        </div>

        <div className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[13px]">
          <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[6px]">{t("page.kpiOperator")}</p>
          <p className="text-[22px] font-semibold tracking-[-0.03em] leading-none text-[#0F1A2E]">{humanConvs.length}</p>
          <p className="text-[10px] text-[#A09E98] mt-[4px]">
            {humanConvs.length === 0 ? t("page.operatorNone") : t("page.operatorSome")}
          </p>
        </div>
      </div>

      {/* Webhook config card */}
      <div className="bg-[#F0FAF6] border border-[#0F6E56]/20 rounded-[12px] px-[16px] py-[13px] mb-[16px] flex items-start gap-[12px]">
        <svg className="w-4 h-4 text-[#0F6E56] shrink-0 mt-[1px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-[#0F6E56] mb-[4px]">{t("page.twilioConfigTitle")}</p>
          <p className="text-[11px] text-[#085041] mb-[6px]">
            {t("page.twilioConfigDesc")}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-white border border-[#0F6E56]/20 rounded-[6px] px-[10px] py-[5px]">
              <span className="text-[11px] font-mono text-[#0F6E56] select-all">{webhookUrl}</span>
            </div>
            <span className="text-[10px] text-[#A09E98]">· {t("page.number")} <span className="font-mono">{fromNumber}</span></span>
          </div>
        </div>
      </div>

      {/* Service error notice */}
      {serviceError && (
        <div className="bg-amber-50 border border-amber-200 rounded-[12px] px-[16px] py-[13px] mb-[16px]">
          <p className="text-[12px] font-medium text-amber-700 mb-[2px]">{t("page.serviceErrorTitle")}</p>
          <p className="text-[11px] text-amber-600">
            {t.rich("page.serviceErrorDesc", {
              code: (chunks) => <code className="font-mono bg-amber-100 px-1 rounded">{chunks}</code>,
            })}
          </p>
        </div>
      )}

      {/* Conversations list (busca + filtros no client) */}
      <ConversationsList
        rows={rows}
        patientBadge={t("page.patientBadge")}
        activeCount={botConvs.length}
        humanCount={humanConvs.length}
      />
    </Shell>
  );
}
