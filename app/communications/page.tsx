import { Shell } from "@/components/shell";
import { getCurrentUserProfile } from "@/services/user-service";
import { getCommunicationLogs, getCommunicationTemplates } from "@/services/communication-service";
import { installDefaultTemplatesAction, updateTemplateAction } from "./actions";
import { ComposeModal } from "./compose-modal";
import { CommunicationTemplateCard } from "@/components/communication-template-card";
import { CommunicationLogList } from "@/components/communication-log-list";

export default async function CommunicationsPage() {
  const profile = await getCurrentUserProfile();
  const clinicId = profile?.clinic_id ?? undefined;

  const [templates, logs] = await Promise.all([
    getCommunicationTemplates(clinicId),
    getCommunicationLogs(clinicId, 30),
  ]);

  const emailTemplates = templates.filter(t => t.channel === "email");
  const smsTemplates   = templates.filter(t => t.channel === "sms");
  const sentCount      = logs.filter(l => l.status === "sent").length;
  const failedCount    = logs.filter(l => l.status === "failed").length;

  return (
    <Shell>
      {/* Header */}
      <div className="flex items-start justify-between mb-[20px]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#A09E98] mb-[2px]">
            Clínica
          </p>
          <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">
            Comunicações
          </h1>
          <p className="text-[12px] text-[#A09E98] mt-[2px]">
            Email e SMS para pacientes e leads
          </p>
        </div>
        <ComposeModal templates={templates} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px] mb-[16px]">
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[13px]">
          <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[6px]">ENVIADAS</p>
          <p className="text-[22px] font-semibold tracking-[-0.03em] leading-none text-[#0F1A2E]">{sentCount}</p>
          <p className="text-[10px] text-[#A09E98] mt-[4px]">mensagens no histórico</p>
        </div>
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[13px]">
          <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[6px]">EMAIL</p>
          <p className="text-[22px] font-semibold tracking-[-0.03em] leading-none text-[#0F1A2E]">{emailTemplates.length}</p>
          <p className="text-[10px] text-[#A09E98] mt-[4px]">templates ativos</p>
        </div>
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[13px]">
          <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[6px]">SMS</p>
          <p className="text-[22px] font-semibold tracking-[-0.03em] leading-none text-[#0F1A2E]">{smsTemplates.length}</p>
          <p className="text-[10px] text-[#A09E98] mt-[4px]">templates ativos</p>
        </div>
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[13px]">
          <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[6px]">FALHAS</p>
          <p className={`text-[22px] font-semibold tracking-[-0.03em] leading-none ${failedCount > 0 ? "text-red-500" : "text-[#0F1A2E]"}`}>
            {failedCount}
          </p>
          <p className="text-[10px] text-[#A09E98] mt-[4px]">envios com erro</p>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-[1fr_300px] gap-[14px]">

        {/* Templates */}
        <div>
          <div className="flex items-center justify-between mb-[10px]">
            <p className="text-[13px] font-medium text-[#0F1A2E]">
              Templates de mensagem
            </p>
            {templates.length === 0 && (
              <form action={installDefaultTemplatesAction}>
                <button
                  type="submit"
                  className="text-[11px] font-medium text-[#0F6E56] border border-[#0F6E56]/30 hover:bg-[#E1F5EE] rounded-[7px] px-[10px] py-[5px] transition"
                >
                  Criar templates padrão
                </button>
              </form>
            )}
          </div>

          {templates.length === 0 ? (
            <div className="bg-white border border-black/[.07] rounded-[14px] flex flex-col items-center justify-center py-[48px] px-[20px] text-center">
              <div className="w-12 h-12 rounded-full bg-[#F4F3EF] flex items-center justify-center mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A09E98" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <p className="text-[13px] text-[#A09E98] mb-[12px]">Nenhum template ainda.</p>
              <form action={installDefaultTemplatesAction}>
                <button
                  type="submit"
                  className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#0A5842] rounded-[8px] px-[16px] py-[8px] transition"
                >
                  Criar templates padrão
                </button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col gap-[8px]">
              {templates.map(t => (
                <CommunicationTemplateCard key={t.id} template={t} updateAction={updateTemplateAction} />
              ))}
            </div>
          )}
        </div>

        {/* Histórico */}
        <div>
          <p className="text-[13px] font-medium text-[#0F1A2E] mb-[10px]">Histórico de envios</p>
          <CommunicationLogList logs={logs} />
        </div>

      </div>
    </Shell>
  );
}
