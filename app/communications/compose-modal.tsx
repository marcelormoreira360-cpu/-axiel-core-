"use client";

import { useState, useTransition } from "react";
import { sendManualAction } from "./actions";
import type { CommunicationTemplate } from "@/services/communication-service";

interface Props {
  templates?: CommunicationTemplate[];
}

export function ComposeModal({ templates = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function applyTemplate(t: CommunicationTemplate) {
    setChannel(t.channel);
    setSubject(t.subject ?? "");
    setBody(t.body);
  }

  function handleClose() {
    setOpen(false);
    setError("");
    setSuccess(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recipient.trim() || !body.trim()) return;
    setError("");
    setSuccess(false);
    startTransition(async () => {
      const res = await sendManualAction({ channel, recipient: recipient.trim(), subject: subject.trim() || null, body: body.trim() });
      if (res.ok) {
        setSuccess(true);
        setRecipient("");
        setSubject("");
        setBody("");
        setTimeout(handleClose, 1800);
      } else {
        setError(res.error ?? "Erro ao enviar mensagem.");
      }
    });
  }

  const emailTemplates = templates.filter(t => t.channel === "email");
  const smsTemplates = templates.filter(t => t.channel === "sms");
  const relevantTemplates = channel === "email" ? emailTemplates : smsTemplates;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-[6px] text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#0A5842] transition px-[12px] py-[7px] rounded-[8px]"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
        Nova mensagem
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/30 z-40" onClick={handleClose} />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="bg-white rounded-[16px] border border-black/[.08] shadow-xl w-full max-w-[500px] pointer-events-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-[20px] py-[15px] border-b border-black/[.06]">
                <p className="text-[14px] font-semibold text-[#0F1A2E]">Nova mensagem</p>
                <button
                  onClick={handleClose}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[#A09E98] hover:bg-[#F4F3EF] transition"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-[20px] flex flex-col gap-[14px]">
                {/* Channel toggle */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] block mb-[6px]">Canal</label>
                  <div className="flex gap-[6px]">
                    {(["email", "sms"] as const).map(ch => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => setChannel(ch)}
                        className={[
                          "flex-1 text-[12px] font-medium py-[8px] rounded-[8px] border transition",
                          channel === ch
                            ? "bg-[#0F6E56] text-white border-[#0F6E56]"
                            : "bg-white text-[#6B6A66] border-black/[.10] hover:bg-[#F4F3EF]",
                        ].join(" ")}
                      >
                        {ch === "email" ? "✉ Email" : "💬 SMS"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Template shortcuts */}
                {relevantTemplates.length > 0 && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] block mb-[6px]">
                      Usar template
                    </label>
                    <div className="flex flex-wrap gap-[5px]">
                      {relevantTemplates.map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => applyTemplate(t)}
                          className="text-[10px] font-medium text-[#0F6E56] border border-[#0F6E56]/25 hover:bg-[#E1F5EE] rounded-full px-[9px] py-[3px] transition"
                        >
                          {t.name.replace(/\s*—\s*e-mail|\s*—\s*SMS/i, "")}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recipient */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] block mb-[6px]">
                    {channel === "email" ? "Email do destinatário" : "Telefone (+5511999999999)"}
                  </label>
                  <input
                    type={channel === "email" ? "email" : "tel"}
                    value={recipient}
                    onChange={e => setRecipient(e.target.value)}
                    placeholder={channel === "email" ? "paciente@email.com" : "+5511999999999"}
                    required
                    className="w-full text-[13px] text-[#0F1A2E] bg-[#FAFAF8] border border-black/[.08] rounded-[8px] px-[10px] py-[8px] outline-none focus:border-[#0F6E56] transition"
                  />
                </div>

                {/* Subject — email only */}
                {channel === "email" && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] block mb-[6px]">Assunto</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      placeholder="Assunto do e-mail"
                      className="w-full text-[13px] text-[#0F1A2E] bg-[#FAFAF8] border border-black/[.08] rounded-[8px] px-[10px] py-[8px] outline-none focus:border-[#0F6E56] transition"
                    />
                  </div>
                )}

                {/* Body */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] block mb-[6px]">Mensagem</label>
                  <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    rows={5}
                    placeholder="Digite sua mensagem..."
                    required
                    className="w-full text-[13px] text-[#0F1A2E] bg-[#FAFAF8] border border-black/[.08] rounded-[8px] px-[10px] py-[8px] outline-none focus:border-[#0F6E56] transition resize-none"
                  />
                  <p className="text-[10px] text-[#D3D1C7] mt-[4px]">
                    Variáveis: {`{{name}}`}, {`{{date}}`}, {`{{time}}`}
                  </p>
                </div>

                {error && <p className="text-[11px] text-red-500">{error}</p>}
                {success && (
                  <p className="text-[11px] text-[#0F6E56] font-medium flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Mensagem enviada com sucesso!
                  </p>
                )}

                <div className="flex gap-[8px] justify-end pt-[2px]">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="text-[12px] font-medium text-[#6B6A66] border border-black/[.10] hover:bg-[#F4F3EF] rounded-[8px] px-[14px] py-[8px] transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!recipient.trim() || !body.trim() || isPending}
                    className="flex items-center gap-[5px] text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#0A5842] disabled:opacity-40 rounded-[8px] px-[14px] py-[8px] transition"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    {isPending ? "Enviando…" : "Enviar"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}
