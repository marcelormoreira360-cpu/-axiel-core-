import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { getConversationByPhone, formatPhone } from "@/services/whatsapp-conversation-service";
import { WhatsAppConversationClient } from "./conversation-client";

type Props = { params: Promise<{ phone: string }> };

export default async function ConversationPage({ params }: Props) {
  const { phone: rawPhone } = await params;
  const phone = decodeURIComponent(rawPhone);
  const conv = await getConversationByPhone(phone);
  if (!conv) notFound();

  return (
    <Shell>
      {/* Header */}
      <div className="flex items-center gap-[10px] mb-[20px]">
        <Link
          href="/whatsapp"
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">
            {formatPhone(conv.phone)}
          </h1>
          <p className="text-[12px] text-[#A09E98] mt-[1px]">
            {conv.messages.length} mensagem{conv.messages.length !== 1 ? "s" : ""} ·{" "}
            {conv.bot_disabled ? (
              <span className="text-amber-600">Atendimento humano</span>
            ) : (
              <span className="text-[#0F6E56]">Bot ativo</span>
            )}
          </p>
        </div>
      </div>

      <WhatsAppConversationClient conversation={conv} />
    </Shell>
  );
}
