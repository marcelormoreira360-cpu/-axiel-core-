"use client";

import Link from "next/link";
import { useState, useTransition, useRef } from "react";
import { FileUp, FileText, Image, Pencil, Check, X, CalendarPlus } from "lucide-react";
import { type PatientPortalData } from "@/services/patient-portal-service";
import { PackagesSection } from "./packages-section";
import { uploadPortalDocumentAction, updatePatientContactAction } from "@/app/p/[token]/actions";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function shortText(value: string | null | undefined, max = 180) {
  const clean = value?.trim();
  if (!clean) return "Sua clínica adicionará uma atualização em breve.";
  return clean.length > max ? `${clean.slice(0, max - 3)}…` : clean;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-black/[.07] p-5 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40">{title}</p>
      {children}
    </div>
  );
}

const FILE_TYPE_ICON: Record<string, React.ReactNode> = {
  pdf:   <FileText className="h-4 w-4 text-red-400" />,
  image: <Image className="h-4 w-4 text-blue-400" />,
};

export function PatientPortalDashboard({
  data,
  rawToken,
  purchaseSuccess = false,
}: {
  data: PatientPortalData;
  rawToken: string;
  purchaseSuccess?: boolean;
}) {
  const firstName = data.patient.full_name.split(" ")[0];
  const nextSession = data.upcomingAppointments[0];
  const pkg = data.activePackage;
  const pkgPercent = pkg ? Math.round((pkg.sessions_used / pkg.sessions_total) * 100) : 0;
  const brandColor = data.clinic.primary_color ?? "#0B1F3A";

  // Contact edit state
  const [editingContact, setEditingContact] = useState(false);
  const [fullName, setFullName] = useState(data.patient.full_name ?? "");
  const [phone, setPhone]   = useState(data.patient.phone ?? "");
  const [email, setEmail]   = useState(data.patient.email ?? "");
  const [contactMsg, setContactMsg] = useState<string | null>(null);
  const [, startContactTransition] = useTransition();

  // Document upload state
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState(data.documents ?? []);
  const fileRef = useRef<HTMLInputElement>(null);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const bookingUrl = data.clinic.slug ? `${appUrl}/book/${data.clinic.slug}` : null;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const result = await uploadPortalDocumentAction(rawToken, fd);
    setUploading(false);
    if (result.ok) {
      setUploadMsg("Arquivo enviado com sucesso!");
      setDocuments((prev) => [
        { id: crypto.randomUUID(), file_name: file.name, file_type: file.type.startsWith("image") ? "image" : file.type === "application/pdf" ? "pdf" : "other", source: "portal", created_at: new Date().toISOString() },
        ...prev,
      ]);
    } else {
      setUploadMsg(result.error ?? "Erro ao enviar.");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleSaveContact() {
    startContactTransition(async () => {
      setContactMsg(null);
      const result = await updatePatientContactAction(rawToken, { full_name: fullName, phone, email });
      if (result.ok) {
        setContactMsg("Dados atualizados!");
        setEditingContact(false);
      } else {
        setContactMsg(result.error ?? "Erro ao salvar.");
      }
    });
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] px-4 py-8 md:py-12">
      <div className="mx-auto w-full max-w-md space-y-4">

        {/* Header */}
        <div className="pb-2">
          {data.clinic.logo_url ? (
            <img
              src={data.clinic.logo_url}
              alt={data.clinic.name}
              className="mb-3 h-8 max-w-[140px] object-contain"
            />
          ) : (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/35">{data.clinic.name}</p>
          )}
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#0F1A2E]">
            Olá, {firstName} 👋
          </h1>
          <p className="mt-1 text-sm text-black/50">Acompanhe seu progresso e suas sessões.</p>
        </div>

        {/* Banner de compra confirmada */}
        {purchaseSuccess && (
          <div className="rounded-2xl bg-[#F0FAF5] border border-[#0F6E56]/20 p-4 flex items-start gap-3">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0F6E56]">
              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0F1A2E]">Compra realizada com sucesso!</p>
              <p className="text-xs text-black/50 mt-0.5">Seu pacote foi ativado e estará disponível em breve.</p>
            </div>
          </div>
        )}

        {/* Próxima sessão */}
        {nextSession ? (
          <div className="rounded-2xl p-5 text-white" style={{ backgroundColor: brandColor }}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50 mb-2">Próxima sessão</p>
            <p className="text-lg font-semibold">{formatDateTime(nextSession.starts_at)}</p>
            {nextSession.duration_minutes && (
              <p className="text-sm text-white/60 mt-1">{nextSession.duration_minutes} minutos</p>
            )}
            {data.whatsappUrl && (
              <Link
                href={data.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block text-xs font-medium text-white/70 hover:text-white underline underline-offset-2 transition"
              >
                Solicitar reagendamento via WhatsApp →
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-black/[.07] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40 mb-2">Próxima sessão</p>
            <p className="text-sm text-black/50">Nenhuma sessão agendada no momento.</p>
            {data.whatsappUrl && (
              <Link
                href={data.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm font-medium text-[#0F6E56] hover:underline"
              >
                Agendar pelo WhatsApp →
              </Link>
            )}
          </div>
        )}

        {/* Pacote ativo */}
        {pkg && (
          <Section title="Seu pacote">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-[#0F1A2E]">{pkg.name}</p>
                <p className="text-sm font-medium text-[#0F6E56]">
                  {pkg.sessions_remaining} sessão(ões) restante(s)
                </p>
              </div>
              <div className="h-2 bg-black/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0F6E56] rounded-full transition-all"
                  style={{ width: `${pkgPercent}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-black/40">
                {pkg.sessions_used} de {pkg.sessions_total} sessões utilizadas
              </p>
            </div>
          </Section>
        )}

        {/* Insight */}
        {data.latestInsight && (
          <Section title="Seu progresso">
            <div>
              <p className="text-base font-semibold text-[#0F1A2E]">{data.latestInsight.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-black/60">
                {shortText(data.latestInsight.summary, 200)}
              </p>
            </div>
            <div className="bg-[#F0FAF5] rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0F6E56]/70 mb-1">Próximo passo</p>
              <p className="text-sm leading-relaxed text-[#0F1A2E]">
                {shortText(data.nextStep, 160)}
              </p>
            </div>
          </Section>
        )}

        {/* Histórico de sessões */}
        {data.sessions.length > 0 && (
          <Section title="Histórico de sessões">
            <div className="space-y-2">
              {data.sessions.slice(0, 5).map((session, index) => (
                <div
                  key={session.id ?? index}
                  className="flex items-center justify-between py-2 border-b border-black/[.05] last:border-0"
                >
                  <span className="text-sm text-black/70">Sessão {data.sessions.length - index}</span>
                  <span className="text-sm text-black/50">{formatDate(session.starts_at)}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Próximas sessões (list) */}
        {data.upcomingAppointments.length > 1 && (
          <Section title="Agendamentos futuros">
            <div className="space-y-2">
              {data.upcomingAppointments.map((appt, index) => (
                <div
                  key={appt.id ?? index}
                  className="flex items-center justify-between py-2 border-b border-black/[.05] last:border-0"
                >
                  <span className="text-sm text-[#0F1A2E]">{formatDateTime(appt.starts_at)}</span>
                  {appt.duration_minutes && (
                    <span className="text-xs text-black/40">{appt.duration_minutes} min</span>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Informações de saúde (intake) */}
        {data.intakeResponses.length > 0 && (
          <Section title="Suas informações de saúde">
            <div className="space-y-3">
              {data.intakeResponses.map((item, idx) => (
                <div key={idx} className="border-b border-black/[.05] pb-3 last:border-0 last:pb-0">
                  <p className="text-xs font-semibold text-black/40 mb-0.5">{item.label}</p>
                  <p className="text-sm text-[#0F1A2E]">{item.answer}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Pacotes disponíveis */}
        <PackagesSection offers={data.availableOffers} rawToken={rawToken} />

        {/* Agendar nova consulta */}
        {bookingUrl && (
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-2xl border-2 py-3.5 text-sm font-semibold transition"
            style={{ borderColor: brandColor, color: brandColor }}
          >
            <CalendarPlus className="h-4 w-4" />
            Agendar nova consulta
          </a>
        )}

        {/* Documentos */}
        <div className="bg-white rounded-2xl border border-black/[.07] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40">Documentos</p>
            <label className="flex items-center gap-1.5 cursor-pointer rounded-xl border border-black/[.10] px-3 py-1.5 text-xs font-medium text-black/60 hover:bg-black/[.04] transition">
              <FileUp className="h-3.5 w-3.5" />
              {uploading ? "Enviando..." : "Enviar arquivo"}
              <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
          {uploadMsg && (
            <p className={`text-xs ${uploadMsg.startsWith("Erro") || uploadMsg.includes("Tipo") || uploadMsg.includes("grande") ? "text-red-500" : "text-[#0F6E56]"}`}>
              {uploadMsg}
            </p>
          )}
          {documents.length === 0 ? (
            <p className="text-sm text-black/40">Nenhum documento enviado ainda.</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-2 py-1.5 border-b border-black/[.05] last:border-0">
                  {FILE_TYPE_ICON[doc.file_type] ?? <FileText className="h-4 w-4 text-black/30" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#0F1A2E] truncate">{doc.file_name}</p>
                    <p className="text-xs text-black/30">{new Date(doc.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                  {doc.source === "portal" && (
                    <span className="text-[10px] text-black/30">Você</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Meus dados */}
        <div className="bg-white rounded-2xl border border-black/[.07] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40">Meus dados</p>
            {!editingContact && (
              <button onClick={() => setEditingContact(true)} className="flex items-center gap-1 text-xs text-black/40 hover:text-black/70 transition">
                <Pencil className="h-3 w-3" /> Editar
              </button>
            )}
          </div>
          {contactMsg && (
            <p className={`text-xs ${contactMsg.startsWith("Erro") ? "text-red-500" : "text-[#0F6E56]"}`}>{contactMsg}</p>
          )}
          {editingContact ? (
            <div className="space-y-2">
              <div>
                <label className="text-xs text-black/40 block mb-1">Nome completo</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome completo"
                  className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30"
                />
              </div>
              <div>
                <label className="text-xs text-black/40 block mb-1">Telefone / WhatsApp</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+55 11 99999-9999"
                  className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30"
                />
              </div>
              <div>
                <label className="text-xs text-black/40 block mb-1">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleSaveContact} className="flex items-center gap-1 rounded-xl bg-[#0F1A2E] text-white px-4 py-2 text-sm font-medium hover:bg-black transition">
                  <Check className="h-3.5 w-3.5" /> Salvar
                </button>
                <button onClick={() => { setEditingContact(false); setContactMsg(null); }} className="flex items-center gap-1 rounded-xl border border-black/[.10] px-4 py-2 text-sm text-black/50 hover:bg-black/[.04] transition">
                  <X className="h-3.5 w-3.5" /> Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-[#0F1A2E]">{data.patient.full_name}</p>
              <p className="text-sm text-[#0F1A2E]">{data.patient.phone || <span className="text-black/30 italic">Telefone não informado</span>}</p>
              <p className="text-sm text-[#0F1A2E]">{data.patient.email || <span className="text-black/30 italic">E-mail não informado</span>}</p>
            </div>
          )}
        </div>

        {/* WhatsApp CTA */}
        {data.whatsappUrl && (
          <Link
            href={data.whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="block w-full rounded-2xl bg-[#25D366] text-white text-center py-3.5 text-sm font-semibold hover:bg-[#22c55e] transition"
          >
            Falar com sua clínica pelo WhatsApp
          </Link>
        )}

        <p className="text-center text-xs text-black/30">
          Esta página é privada. Não compartilhe este link.
        </p>
        <p className="pb-4 text-center text-[11px] text-black/25 leading-relaxed">
          Seus dados são tratados conforme a LGPD (Lei 13.709/2018).{" "}
          <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="underline hover:text-black/40 transition">
            Política de Privacidade
          </a>
        </p>
      </div>
    </div>
  );
}
