import type { CommunicationTemplate } from "@/services/communication-service";
import { communicationUseCaseLabels } from "@/modules/communications/templates";

const CHANNEL_BADGE: Record<string, { label: string; className: string }> = {
  email: { label: "Email",  className: "bg-blue-50 text-blue-600" },
  sms:   { label: "SMS",    className: "bg-purple-50 text-purple-600" },
};

export function CommunicationTemplateCard({
  template,
  updateAction,
}: {
  template: CommunicationTemplate;
  updateAction: (formData: FormData) => Promise<void>;
}) {
  const badge = CHANNEL_BADGE[template.channel] ?? { label: template.channel, className: "bg-[#F4F3EF] text-[#6B6A66]" };

  return (
    <form
      action={updateAction}
      className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[13px]"
    >
      <input type="hidden" name="id" value={template.id} />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-[10px]">
        <div className="flex flex-col gap-[5px]">
          <div className="flex items-center gap-[6px] flex-wrap">
            <span className={`text-[9px] font-semibold uppercase tracking-wider px-[7px] py-[2px] rounded-full ${badge.className}`}>
              {badge.label}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-wider bg-[#F4F3EF] text-[#6B6A66] px-[7px] py-[2px] rounded-full">
              {communicationUseCaseLabels[template.use_case] ?? template.use_case}
            </span>
          </div>
          <p className="text-[13px] font-medium text-[#0F1A2E]">{template.name}</p>
        </div>
        <button
          type="submit"
          className="shrink-0 text-[11px] font-medium text-[#0F6E56] border border-[#0F6E56]/30 hover:bg-[#E1F5EE] rounded-[7px] px-[10px] py-[5px] transition"
        >
          Salvar
        </button>
      </div>

      {/* Subject — email only */}
      {template.channel === "email" && (
        <label className="block mb-[8px]">
          <span className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] block mb-[4px]">Assunto</span>
          <input
            name="subject"
            defaultValue={template.subject ?? ""}
            placeholder="Assunto do e-mail"
            className="w-full text-[12px] text-[#0F1A2E] bg-[#FAFAF8] border border-black/[.08] rounded-[8px] px-[9px] py-[7px] outline-none focus:border-[#0F6E56] transition"
          />
        </label>
      )}

      {/* Body */}
      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] block mb-[4px]">Mensagem</span>
        <textarea
          name="body"
          defaultValue={template.body}
          rows={3}
          className="w-full text-[12px] text-[#0F1A2E] bg-[#FAFAF8] border border-black/[.08] rounded-[8px] px-[9px] py-[7px] outline-none focus:border-[#0F6E56] transition resize-none leading-relaxed"
        />
      </label>

      <p className="text-[10px] text-[#D3D1C7] mt-[5px]">
        Variáveis: {`{{name}}`}, {`{{date}}`}, {`{{time}}`}, {`{{duration}}`}
      </p>
    </form>
  );
}
