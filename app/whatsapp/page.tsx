import Link from "next/link";
import { Shell } from "@/components/shell";
import { getCurrentUserProfile } from "@/services/user-service";
import {
  listConversations,
  getWaStats,
  getLastMessage,
  formatPhone,
  type WaConversation,
} from "@/services/whatsapp-conversation-service";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  return `${Math.floor(hrs / 24)}d atrás`;
}

function ConvRow({ conv }: { conv: WaConversation }) {
  const last = getLastMessage(conv);
  const msgCount = conv.messages.length;
  const phoneForUrl = encodeURIComponent(conv.phone);

  return (
    <Link
      href={`/whatsapp/${phoneForUrl}`}
      className="flex items-center gap-[12px] px-[16px] py-[13px] hover:bg-[#FAFAF8] transition group"
    >
      {/* Avatar */}
      <div
        className={[
          "w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-medium shrink-0",
          conv.handled_by_human
            ? "bg-amber-50 text-amber-600"
            : conv.bot_disabled
            ? "bg-red-50 text-red-500"
            : "bg-[#E1F5EE] text-[#0F6E56]",
        ].join(" ")}
      >
        {conv.phone.replace(/\D/g, "").slice(-2)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-medium text-[#0F1A2E] truncate">
            {formatPhone(conv.phone)}
          </p>
          {conv.bot_disabled && (
            <span className="text-[9px] font-semibold uppercase tracking-wider bg-amber-50 text-amber-600 px-[6px] py-[1px] rounded-full shrink-0">
              Operador
            </span>
          )}
          {conv.linked_patient_id && (
            <span className="text-[9px] font-semibold uppercase tracking-wider bg-[#E1F5EE] text-[#0F6E56] px-[6px] py-[1px] rounded-full shrink-0">
              Paciente
            </span>
          )}
        </div>
        <p className="text-[11px] text-[#A09E98] truncate mt-[1px]">
          {last
            ? `${last.role === "user" ? "→" : "←"} ${last.content.replace(/\[MANUAL\]\s?/, "")}`
            : "Sem mensagens"}
        </p>
      </div>

      {/* Meta */}
      <div className="text-right shrink-0">
        <p className="text-[10px] text-[#A09E98]">{timeAgo(conv.updated_at)}</p>
        <p className="text-[10px] text-[#D3D1C7] mt-[1px]">{msgCount} msg</p>
      </div>

      {/* Arrow */}
      <svg className="w-3 h-3 text-[#D3D1C7] group-hover:text-[#A09E98] transition shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m9 18 6-6-6-6"/>
      </svg>
    </Link>
  );
}

export default async function WhatsAppMonitorPage() {
  const profile = await getCurrentUserProfile();
  const clinicId = profile?.clinic_id ?? undefined;

  const [convs, stats] = await Promise.all([
    listConversations(clinicId),
    getWaStats(clinicId),
  ]);

  const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://app.axiel.com.br"}/api/whatsapp/webhook`;
  const fromNumber = process.env.TWILIO_FROM_NUMBER ?? "—";

  const humanConvs = convs.filter((c) => c.bot_disabled);
  const botConvs = convs.filter((c) => !c.bot_disabled);

  return (
    <Shell>
      {/* Header */}
      <div className="flex items-start justify-between mb-[20px]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#A09E98] mb-[2px]">
            Atendimento
          </p>
          <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">
            WhatsApp Bot
          </h1>
          <p className="text-[12px] text-[#A09E98] mt-[2px]">
            Monitor de conversas e assistente IA
          </p>
        </div>
        <Link
          href="/settings/whatsapp"
          className="flex items-center gap-[6px] text-[12px] font-medium text-[#0F1A2E] border border-black/[.10] hover:bg-[#F4F3EF] transition px-[12px] py-[7px] rounded-[8px]"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Configurar bot
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px] mb-[16px]">
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[13px]">
          <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[6px]">BOT STATUS</p>
          <div className="flex items-center gap-[6px]">
            <span className={`w-2 h-2 rounded-full shrink-0 ${stats.botActive ? "bg-[#0F6E56]" : "bg-[#D3D1C7]"}`} />
            <p className={`text-[18px] font-semibold leading-none ${stats.botActive ? "text-[#0F6E56]" : "text-[#A09E98]"}`}>
              {stats.botActive ? "Ativo" : "Inativo"}
            </p>
          </div>
          <p className="text-[10px] text-[#A09E98] mt-[4px]">via Twilio + GPT-4o-mini</p>
        </div>

        <div className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[13px]">
          <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[6px]">CONVERSAS</p>
          <p className="text-[22px] font-semibold tracking-[-0.03em] leading-none text-[#0F1A2E]">{stats.total}</p>
          <p className="text-[10px] text-[#A09E98] mt-[4px]">
            {stats.newToday > 0 ? `+${stats.newToday} hoje` : "sem novas hoje"}
          </p>
        </div>

        <div className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[13px]">
          <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[6px]">MENSAGENS</p>
          <p className="text-[22px] font-semibold tracking-[-0.03em] leading-none text-[#0F1A2E]">{stats.messagesToday}</p>
          <p className="text-[10px] text-[#A09E98] mt-[4px]">total no histórico</p>
        </div>

        <div className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[13px]">
          <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[6px]">OPERADOR</p>
          <p className="text-[22px] font-semibold tracking-[-0.03em] leading-none text-[#0F1A2E]">{humanConvs.length}</p>
          <p className="text-[10px] text-[#A09E98] mt-[4px]">
            {humanConvs.length === 0 ? "bot respondendo a todos" : "conversas em atendimento humano"}
          </p>
        </div>
      </div>

      {/* Webhook config card */}
      <div className="bg-[#F0FAF6] border border-[#0F6E56]/20 rounded-[12px] px-[16px] py-[13px] mb-[16px] flex items-start gap-[12px]">
        <svg className="w-4 h-4 text-[#0F6E56] shrink-0 mt-[1px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-[#0F6E56] mb-[4px]">Configuração Twilio</p>
          <p className="text-[11px] text-[#085041] mb-[6px]">
            Configure o webhook abaixo no Twilio Console → WhatsApp Sandbox ou número comprado:
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-white border border-[#0F6E56]/20 rounded-[6px] px-[10px] py-[5px]">
              <span className="text-[11px] font-mono text-[#0F6E56] select-all">{webhookUrl}</span>
            </div>
            <span className="text-[10px] text-[#A09E98]">· Número: <span className="font-mono">{fromNumber}</span></span>
          </div>
        </div>
      </div>

      {/* Conversations list */}
      <div className="bg-white border border-black/[.07] rounded-[14px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-[16px] py-[12px] border-b border-black/[.05]">
          <p className="text-[12px] font-medium text-[#0F1A2E]">
            {convs.length} conversa{convs.length !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2 text-[11px] text-[#A09E98]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#0F6E56]" />
              Bot ({botConvs.length})
            </span>
            {humanConvs.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Operador ({humanConvs.length})
              </span>
            )}
          </div>
        </div>

        {convs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-[48px] px-[20px] text-center">
            <div className="w-12 h-12 rounded-full bg-[#F4F3EF] flex items-center justify-center mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A09E98" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <p className="text-[13px] text-[#A09E98]">Nenhuma conversa ainda.</p>
            <p className="text-[11px] text-[#C5C3BC] mt-1">
              Configure o webhook no Twilio e envie uma mensagem de teste.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-black/[.04]">
            {convs.map((conv) => (
              <ConvRow key={conv.id} conv={conv} />
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
