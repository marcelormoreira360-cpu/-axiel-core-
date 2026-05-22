"use client";

import { useState } from "react";
import { Copy, Check, Link2, Calendar, FileText, UserCircle2, ExternalLink } from "lucide-react";

interface Practitioner {
  user_id: string;
  display_name: string | null;
  specialty: string | null;
  full_name: string | null;
}

function CopyButton({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-[5px] text-[11px] font-medium text-[#0F6E56] border border-[#0F6E56]/30 hover:bg-[#E1F5EE] rounded-[6px] px-[10px] py-[6px] transition shrink-0"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" />
          Copiado!
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          Copiar
        </>
      )}
    </button>
  );
}

function LinkCard({
  icon,
  title,
  description,
  url,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  url: string;
  badge?: string;
}) {
  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
      <div className="flex items-start justify-between gap-[12px]">
        <div className="flex items-start gap-[10px] min-w-0 flex-1">
          <div className="w-8 h-8 rounded-[8px] bg-[#F4F3EF] flex items-center justify-center shrink-0 mt-[1px]">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-[6px] mb-[2px]">
              <p className="text-[13px] font-medium text-[#0F1A2E]">{title}</p>
              {badge && (
                <span className="text-[9px] font-semibold tracking-[.06em] uppercase text-[#0F6E56] bg-[#E1F5EE] rounded-full px-[6px] py-[1px]">
                  {badge}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#A09E98] mb-[8px]">{description}</p>
            <div className="flex items-center gap-[6px]">
              <span className="text-[11px] font-mono text-[#6B6A66] bg-[#F4F3EF] rounded-[5px] px-[8px] py-[3px] truncate max-w-[260px]">
                {url}
              </span>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#A09E98] hover:text-[#0F6E56] transition"
                title="Abrir em nova aba"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
        <CopyButton url={url} label={title} />
      </div>
    </div>
  );
}

export function LinksHub({
  baseUrl,
  clinicSlug,
  clinicName,
  practitioners,
}: {
  baseUrl: string;
  clinicSlug: string;
  clinicName: string;
  practitioners: Practitioner[];
}) {
  const bookingUrl = `${baseUrl}/book/${clinicSlug}`;
  const intakeUrl  = `${baseUrl}/envio/${clinicSlug}`;

  return (
    <div className="space-y-[22px]">
      {/* ── Links principais ── */}
      <section>
        <p className="text-[11px] font-medium tracking-[.08em] uppercase text-[#A09E98] mb-[10px]">
          Links da clínica
        </p>
        <div className="space-y-[8px]">
          <LinkCard
            icon={<Calendar className="h-4 w-4 text-[#0F6E56]" />}
            title="Agendamento online"
            description={`Pacientes podem agendar uma sessão com ${clinicName} de forma automática.`}
            url={bookingUrl}
            badge="Principal"
          />
          <LinkCard
            icon={<FileText className="h-4 w-4 text-[#A09E98]" />}
            title="Envio de documentos"
            description="Link para o paciente enviar exames, fichas e anamneses antes da consulta."
            url={intakeUrl}
          />
        </div>
      </section>

      {/* ── Profissionais ── */}
      {practitioners.length > 0 && (
        <section>
          <p className="text-[11px] font-medium tracking-[.08em] uppercase text-[#A09E98] mb-[10px]">
            Por profissional — o paciente escolhe ao abrir o link
          </p>
          <div className="space-y-[8px]">
            {practitioners.map((p) => {
              const name = p.display_name ?? p.full_name ?? "Profissional";
              return (
                <LinkCard
                  key={p.user_id}
                  icon={<UserCircle2 className="h-4 w-4 text-[#A09E98]" />}
                  title={name}
                  description={p.specialty ? `Especialidade: ${p.specialty}` : "Profissional disponível para agendamento."}
                  url={bookingUrl}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* ── Portal individual ── */}
      <section>
        <div className="bg-[#F4F3EF] rounded-[12px] px-[16px] py-[14px]">
          <div className="flex items-start gap-[10px]">
            <div className="w-8 h-8 rounded-[8px] bg-white border border-black/[.07] flex items-center justify-center shrink-0 mt-[1px]">
              <Link2 className="h-4 w-4 text-[#A09E98]" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-[#0F1A2E] mb-[2px]">Links individuais do paciente</p>
              <p className="text-[12px] text-[#6B6A66] leading-relaxed">
                Para enviar um link privado de portal para um paciente específico, acesse o perfil do paciente e clique em{" "}
                <strong className="text-[#0F1A2E]">Link do portal</strong>. O link é único, não requer login e expira em 7 dias.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── WhatsApp tip ── */}
      <section>
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
          <p className="text-[12px] font-medium text-[#0F1A2E] mb-[4px]">💡 Dica de envio</p>
          <p className="text-[12px] text-[#6B6A66] leading-relaxed">
            Copie o link de agendamento e envie por WhatsApp, e-mail ou adicione na bio do Instagram.
            Seus pacientes poderão agendar sem precisar ligar.
          </p>
        </div>
      </section>
    </div>
  );
}
