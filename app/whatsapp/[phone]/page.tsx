import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { getConversationByPhone, formatPhone } from "@/services/whatsapp-conversation-service";
import { handoffStatus } from "@/lib/whatsapp-handoff";
import { WhatsAppConversationClient } from "./conversation-client";

type Props = { params: Promise<{ phone: string }> };

export default async function ConversationPage({ params }: Props) {
  const { phone: rawPhone } = await params;
  const phone = decodeURIComponent(rawPhone);
  const [conv, t] = await Promise.all([
    getConversationByPhone(phone),
    getTranslations("whatsapp"),
  ]);
  if (!conv) notFound();

  const status = handoffStatus({
    aiPaused: conv.ai_paused,
    botDisabled: conv.bot_disabled,
    lastHumanMessageAt: conv.last_human_message_at,
  });

  return (
    <Shell>
      {/* Header */}
      <div className="flex items-center gap-[10px] mb-[20px]">
        <BackLink
          fallbackHref="/whatsapp"
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </BackLink>
        <div className="flex-1">
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">
            {formatPhone(conv.phone)}
          </h1>
          <p className="text-[12px] text-[#A09E98] mt-[1px]">
            {conv.messages.length} mensagem{conv.messages.length !== 1 ? "s" : ""} ·{" "}
            {status === "paused" ? (
              <span className="text-red-500">{t("handoff.status.paused")}</span>
            ) : status === "with_team" ? (
              <span className="text-amber-600">{t("handoff.status.withTeam")}</span>
            ) : (
              <span className="text-[#0F6E56]">{t("handoff.status.active")}</span>
            )}
          </p>
        </div>
      </div>

      <WhatsAppConversationClient conversation={conv} />
    </Shell>
  );
}
