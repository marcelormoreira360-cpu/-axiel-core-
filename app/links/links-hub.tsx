"use client";

import { useState, useTransition } from "react";
import { Copy, Check, Calendar, FileText, UserCircle2, ExternalLink, Video, Save } from "lucide-react";

interface Practitioner {
  user_id: string;
  display_name: string | null;
  specialty: string | null;
  full_name: string | null;
  zoom_personal_url?: string | null;
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-[5px] text-[11px] font-medium text-[#0F6E56] border border-[#0F6E56]/30 hover:bg-[#E1F5EE] rounded-[6px] px-[10px] py-[6px] transition shrink-0"
    >
      {copied ? <><Check className="h-3 w-3" />Copiado!</> : <><Copy className="h-3 w-3" />Copiar</>}
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
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#A09E98] hover:text-[#0F6E56] transition" title="Abrir">
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
        <CopyButton url={url} />
      </div>
    </div>
  );
}

function ZoomCard({
  myZoomUrl,
  saveAction,
}: {
  myZoomUrl: string | null;
  saveAction: (formData: FormData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(!myZoomUrl);
  const [value, setValue] = useState(myZoomUrl ?? "");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("zoom_url", value);
    startTransition(async () => {
      await saveAction(fd);
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
      <div className="flex items-start gap-[10px]">
        <div className="w-8 h-8 rounded-[8px] bg-[#F4F3EF] flex items-center justify-center shrink-0 mt-[1px]">
          <Video className="h-4 w-4 text-[#2D8CFF]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[6px] mb-[2px]">
            <p className="text-[13px] font-medium text-[#0F1A2E]">Teleconsulta Zoom</p>
          </div>
          <p className="text-[11px] text-[#A09E98] mb-[10px]">
            Link da sua sala pessoal Zoom para enviar aos pacientes.
          </p>

          {editing ? (
            <form onSubmit={handleSubmit} className="flex items-center gap-[6px]">
              <input
                type="url"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="https://zoom.us/j/123456789"
                className="flex-1 text-[12px] font-mono text-[#0F1A2E] bg-[#F4F3EF] border border-black/[.08] rounded-[6px] px-[10px] py-[6px] outline-none focus:border-[#0F6E56]/40 focus:bg-white transition"
              />
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-[4px] text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-50 rounded-[6px] px-[10px] py-[6px] transition shrink-0"
              >
                <Save className="h-3 w-3" />
                {isPending ? "Salvando…" : "Salvar"}
              </button>
              {myZoomUrl && (
                <button type="button" onClick={() => { setValue(myZoomUrl); setEditing(false); }}
                  className="text-[11px] text-[#A09E98] hover:text-[#0F1A2E] transition shrink-0">
                  Cancelar
                </button>
              )}
            </form>
          ) : (
            <div className="flex items-center gap-[6px]">
              <span className="text-[11px] font-mono text-[#6B6A66] bg-[#F4F3EF] rounded-[5px] px-[8px] py-[3px] truncate max-w-[220px]">
                {myZoomUrl}
              </span>
              <a href={myZoomUrl!} target="_blank" rel="noopener noreferrer"
                className="text-[#A09E98] hover:text-[#0F6E56] transition">
                <ExternalLink className="h-3 w-3" />
              </a>
              <button type="button" onClick={() => setEditing(true)}
                className="text-[11px] text-[#A09E98] hover:text-[#0F1A2E] transition ml-[2px]">
                Editar
              </button>
              {saved && <span className="text-[11px] text-[#0F6E56]">✓ Salvo</span>}
            </div>
          )}
        </div>

        {!editing && myZoomUrl && (
          <CopyButton url={myZoomUrl} />
        )}
      </div>
    </div>
  );
}

export function LinksHub({
  baseUrl,
  clinicSlug,
  clinicName,
  practitioners,
  myZoomUrl,
  saveZoomUrlAction,
}: {
  baseUrl: string;
  clinicSlug: string;
  clinicName: string;
  practitioners: Practitioner[];
  myZoomUrl: string | null;
  saveZoomUrlAction: (formData: FormData) => Promise<void>;
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

      {/* ── Zoom ── */}
      <section>
        <p className="text-[11px] font-medium tracking-[.08em] uppercase text-[#A09E98] mb-[10px]">
          Teleconsulta
        </p>
        <ZoomCard myZoomUrl={myZoomUrl} saveAction={saveZoomUrlAction} />
      </section>

      {/* ── Profissionais ── */}
      {practitioners.length > 0 && (
        <section>
          <p className="text-[11px] font-medium tracking-[.08em] uppercase text-[#A09E98] mb-[10px]">
            Por profissional
          </p>
          <div className="space-y-[8px]">
            {practitioners.map((p) => {
              const name = p.display_name ?? p.full_name ?? "Profissional";
              const zoomUrl = p.zoom_personal_url;
              return (
                <div key={p.user_id} className="space-y-[4px]">
                  <LinkCard
                    icon={<UserCircle2 className="h-4 w-4 text-[#A09E98]" />}
                    title={name}
                    description={p.specialty ? `Especialidade: ${p.specialty}` : "Agendamento online disponível."}
                    url={bookingUrl}
                  />
                  {zoomUrl && (
                    <div className="ml-[10px]">
                      <LinkCard
                        icon={<Video className="h-4 w-4 text-[#2D8CFF]" />}
                        title={`${name} — Zoom`}
                        description="Link direto da sala Zoom deste profissional."
                        url={zoomUrl}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Portal individual ── */}
      <section>
        <div className="bg-[#F4F3EF] rounded-[12px] px-[16px] py-[14px]">
          <p className="text-[13px] font-medium text-[#0F1A2E] mb-[4px]">Links individuais do paciente</p>
          <p className="text-[12px] text-[#6B6A66] leading-relaxed">
            Para enviar um link privado de portal para um paciente específico, acesse o perfil do paciente → <strong className="text-[#0F1A2E]">Link do portal</strong>. Único, sem login, expira em 7 dias.
          </p>
        </div>
      </section>

      {/* ── Dica WhatsApp ── */}
      <section>
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
          <p className="text-[12px] font-medium text-[#0F1A2E] mb-[4px]">💡 Dica</p>
          <p className="text-[12px] text-[#6B6A66] leading-relaxed">
            Copie o link de agendamento e envie por WhatsApp, e-mail ou coloque na bio do Instagram. Seus pacientes agendam sem precisar ligar.
          </p>
        </div>
      </section>
    </div>
  );
}
