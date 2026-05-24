"use client";

import Link from "next/link";
import { useState, useTransition, useRef } from "react";
import { FileUp, FileText, Image, Pencil, Check, X, CalendarPlus, MessageCircle, ChevronDown, ChevronUp, Receipt } from "lucide-react";
import { type PatientPortalData } from "@/services/patient-portal-service";
import { PackagesSection } from "./packages-section";
import { PortalBookingModal } from "./portal-booking-modal";
import { NpsWidget } from "./nps-widget";
import { PortalChat } from "./portal-chat";
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

function SubscriptionCard({
  sub,
  brandColor,
}: {
  sub: NonNullable<PatientPortalData["activeSubscription"]>;
  brandColor: string;
}) {
  const fmt = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: sub.currency }).format(cents / 100);

  const renewsAt = sub.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })
    : null;

  const statusConfig: Record<string, { label: string; color: string }> = {
    active:    { label: "Ativo",          color: "#0F6E56" },
    trialing:  { label: "Em teste",       color: "#3B82F6" },
    past_due:  { label: "Pagamento pendente", color: "#F59E0B" },
    paused:    { label: "Pausado",        color: "#6B7280" },
    canceled:  { label: "Cancelado",      color: "#EF4444" },
    incomplete: { label: "Incompleto",    color: "#F59E0B" },
  };
  const st = statusConfig[sub.status] ?? { label: sub.status, color: "#6B7280" };

  const sessionsLeft = sub.sessionsPerCycle > 0 ? sub.sessionsPerCycle - sub.sessionsUsedThisCycle : null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#0F1A2E]">{sub.planName}</p>
          <p className="text-xs text-black/45 mt-0.5">
            {fmt(sub.amountCents)} / {sub.billingInterval === "yearly" ? "ano" : "mês"}
          </p>
        </div>
        <span
          className="text-[10px] font-semibold uppercase tracking-[.1em] px-2 py-1 rounded-full"
          style={{ backgroundColor: `${st.color}15`, color: st.color }}
        >
          {st.label}
        </span>
      </div>

      {sessionsLeft !== null && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between mb-1">
            <p className="text-xs text-black/50">Sessões este ciclo</p>
            <p className="text-xs font-medium text-[#0F1A2E]">
              {sub.sessionsUsedThisCycle} / {sub.sessionsPerCycle}
            </p>
          </div>
          <div className="h-1.5 bg-black/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, Math.round((sub.sessionsUsedThisCycle / sub.sessionsPerCycle) * 100))}%`,
                backgroundColor: brandColor,
              }}
            />
          </div>
          <p className="text-xs text-black/35 mt-1">
            {sessionsLeft} sessão(ões) restante(s) neste ciclo
          </p>
        </div>
      )}

      {renewsAt && !sub.cancelAtPeriodEnd && sub.status !== "canceled" && (
        <p className="text-xs text-black/35 mt-2">
          {sub.status === "past_due" ? "Renovação pendente em " : "Renova em "}
          {renewsAt}
        </p>
      )}
      {sub.cancelAtPeriodEnd && renewsAt && (
        <p className="text-xs text-amber-500 mt-2">Cancela em {renewsAt}</p>
      )}
      {sub.status === "past_due" && (
        <p className="text-xs text-amber-600 mt-2 font-medium">
          ⚠️ Entre em contato com a clínica para regularizar o pagamento.
        </p>
      )}
    </div>
  );
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

// ── Per-session pay button ───────────────────────────────────────────────────
function PaySessionButton({
  appointmentId,
  priceCents,
  rawToken,
  brandColor,
}: {
  appointmentId: string;
  priceCents: number;
  rawToken: string;
  brandColor: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(priceCents / 100);

  async function handlePay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/session-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portal_token: rawToken, appointment_id: appointmentId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao iniciar pagamento."); return; }
      window.location.href = data.url;
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handlePay}
        disabled={loading}
        className="shrink-0 rounded-xl px-3 py-1 text-xs font-semibold text-white transition disabled:opacity-50"
        style={{ backgroundColor: brandColor }}
      >
        {loading ? "…" : `Pagar ${formatted}`}
      </button>
      {error && <p className="text-[10px] text-red-500 max-w-[120px] text-right">{error}</p>}
    </div>
  );
}

// ── Session history card with expandable observations ────────────────────────
function SessionHistoryCard({
  session,
  sessionNumber,
  rawToken,
  brandColor,
}: {
  session: import("@/services/patient-portal-service").PatientPortalSessionItem;
  sessionNumber: number;
  rawToken: string;
  brandColor: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasObs = session.observations.length > 0;

  return (
    <div className="border-b border-black/[.05] last:border-0">
      <div className="flex items-start justify-between py-2.5 gap-2">
        {/* Left: session number + meta */}
        <button
          onClick={() => hasObs && setExpanded((v) => !v)}
          className={`flex-1 flex items-start gap-2 text-left min-w-0 ${hasObs ? "cursor-pointer" : "cursor-default"}`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-[#0F1A2E]">Sessão {sessionNumber}</span>
              <span className="text-xs text-black/40">{formatDate(session.starts_at)}</span>
              {session.session_type_name && (
                <span className="text-[10px] bg-black/[.05] text-black/45 rounded-full px-2 py-0.5">
                  {session.session_type_name}
                </span>
              )}
              {session.duration_minutes > 0 && (
                <span className="text-[10px] text-black/30">{session.duration_minutes} min</span>
              )}
            </div>
          </div>
          {hasObs && (
            <span className="shrink-0 text-black/25 mt-0.5">
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </span>
          )}
        </button>

        {/* Right: payment status */}
        <div className="flex items-center gap-2 shrink-0">
          {session.payment_status === "paid" && (
            <span className="text-xs font-medium text-[#0F6E56]">✓ Pago</span>
          )}
          {session.payment_status === "covered" && (
            <span className="text-xs text-black/40">Pacote</span>
          )}
          {session.payment_status === "pending" && (
            <PaySessionButton
              appointmentId={session.id}
              priceCents={session.price_cents}
              rawToken={rawToken}
              brandColor={brandColor}
            />
          )}
          {session.has_feedback && (
            <span className="text-[10px] text-black/30">⭐</span>
          )}
        </div>
      </div>

      {/* Expandable observations */}
      {expanded && hasObs && (
        <div className="mb-3 ml-1 bg-[#F8F9FA] rounded-xl px-3 py-2.5 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-black/35 mb-1">Observações da sessão</p>
          {session.observations.map((obs, i) => (
            <p key={i} className="text-xs text-black/60 leading-relaxed">
              • {obs}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function PatientPortalDashboard({
  data,
  rawToken,
  purchaseSuccess = false,
  paymentSuccess = false,
  subscriptionSuccess = false,
}: {
  data: PatientPortalData;
  rawToken: string;
  purchaseSuccess?: boolean;
  paymentSuccess?: boolean;
  subscriptionSuccess?: boolean;
}) {
  const firstName = data.patient.full_name.split(" ")[0];
  const nextSession = data.upcomingAppointments[0];
  const pkg = data.activePackage;
  const pkgPercent = pkg ? Math.round((pkg.sessions_used / pkg.sessions_total) * 100) : 0;
  const brandColor = data.clinic.primary_color ?? "#0B1F3A";

  // Self-booking modal state
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  // NPS feedback state
  // The session to rate: most recent past session that hasn't been rated yet
  const [ratingDismissed, setRatingDismissed] = useState(false);
  const sessionToRate = !ratingDismissed
    ? data.sessions.find((s) => !s.has_feedback) ?? null
    : null;

  // Contact edit state
  const [editingContact, setEditingContact] = useState(false);
  const [fullName, setFullName] = useState(data.patient.full_name ?? "");
  const [phone, setPhone]   = useState(data.patient.phone ?? "");
  const [email, setEmail]         = useState(data.patient.email ?? "");
  const [dob, setDob]             = useState(data.patient.date_of_birth ?? "");
  const [addressLine, setAddress] = useState(data.patient.address_line ?? "");
  const [city, setCity]           = useState(data.patient.city ?? "");
  const [state, setState]         = useState(data.patient.state ?? "");
  const [zipCode, setZipCode]     = useState(data.patient.zip_code ?? "");
  const [country, setCountry]     = useState(data.patient.country ?? "Brasil");
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
      const result = await updatePatientContactAction(rawToken, {
        full_name: fullName,
        phone,
        email,
        date_of_birth: dob,
        address_line: addressLine,
        city,
        state,
        zip_code: zipCode,
        country,
      });
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

        {/* Banner de pagamento de sessão confirmado */}
        {paymentSuccess && (
          <div className="rounded-2xl bg-[#F0FAF5] border border-[#0F6E56]/20 p-4 flex items-start gap-3">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0F6E56]">
              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0F1A2E]">Pagamento confirmado!</p>
              <p className="text-xs text-black/50 mt-0.5">Sessão registrada como paga.</p>
            </div>
          </div>
        )}

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

        {/* Banner de assinatura confirmada */}
        {subscriptionSuccess && (
          <div className="rounded-2xl bg-[#EFF6FF] border border-[#3B82F6]/20 p-4 flex items-start gap-3">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#3B82F6]">
              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0F1A2E]">Assinatura ativada!</p>
              <p className="text-xs text-black/50 mt-0.5">Seu plano está ativo e você já pode aproveitar seus benefícios.</p>
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
            {nextSession.payment_status === "pending" && (
              <div className="mt-4">
                <PaySessionButton
                  appointmentId={nextSession.id}
                  priceCents={nextSession.price_cents}
                  rawToken={rawToken}
                  brandColor="rgba(255,255,255,0.9)"
                />
              </div>
            )}
            {nextSession.payment_status === "paid" && (
              <p className="mt-3 text-xs font-medium text-white/70">✓ Sessão paga</p>
            )}
            {nextSession.payment_status === "covered" && (
              <p className="mt-3 text-xs font-medium text-white/70">✓ Coberta pelo pacote</p>
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

        {/* Assinatura ativa */}
        {data.activeSubscription && (
          <Section title="Meu plano">
            <SubscriptionCard sub={data.activeSubscription} brandColor={brandColor} />
          </Section>
        )}

        {/* NPS — avalie sua sessão mais recente */}
        {sessionToRate && (
          <NpsWidget
            appointmentId={sessionToRate.id}
            sessionDate={sessionToRate.starts_at}
            rawToken={rawToken}
            brandColor={brandColor}
            onSubmit={() => setRatingDismissed(true)}
          />
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
            <div className="space-y-1">
              {data.sessions.slice(0, 5).map((session, index) => (
                <SessionHistoryCard
                  key={session.id ?? index}
                  session={session}
                  sessionNumber={data.sessions.length - index}
                  rawToken={rawToken}
                  brandColor={brandColor}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Histórico de pagamentos */}
        {data.paymentHistory.length > 0 && (
          <Section title="Histórico de pagamentos">
            <div className="space-y-0 divide-y divide-black/[.05]">
              {data.paymentHistory.map((payment) => {
                const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: payment.currency }).format(payment.amount_cents / 100);
                const paidDate = payment.paid_at
                  ? new Date(payment.paid_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
                  : "—";
                const label = payment.description ?? (payment.appointment_id ? "Sessão" : "Pagamento");
                return (
                  <div key={payment.id} className="flex items-center justify-between py-2.5 gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Receipt className="h-3.5 w-3.5 shrink-0 text-black/25" />
                      <div className="min-w-0">
                        <p className="text-sm text-[#0F1A2E] truncate">{label}</p>
                        <p className="text-xs text-black/35">{paidDate}</p>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-[#0F6E56]">{fmt}</span>
                  </div>
                );
              })}
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
                  className="flex items-start justify-between py-2 border-b border-black/[.05] last:border-0 gap-2"
                >
                  <div>
                    <span className="text-sm text-[#0F1A2E]">{formatDateTime(appt.starts_at)}</span>
                    {appt.duration_minutes && (
                      <span className="ml-2 text-xs text-black/40">{appt.duration_minutes} min</span>
                    )}
                  </div>
                  {appt.payment_status === "pending" && (
                    <PaySessionButton
                      appointmentId={appt.id}
                      priceCents={appt.price_cents}
                      rawToken={rawToken}
                      brandColor={brandColor}
                    />
                  )}
                  {appt.payment_status === "paid" && (
                    <span className="shrink-0 text-xs font-medium text-[#0F6E56]">✓ Pago</span>
                  )}
                  {appt.payment_status === "covered" && (
                    <span className="shrink-0 text-xs text-black/40">Pacote</span>
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
        {data.sessionTypes.length > 0 ? (
          <>
            {bookingConfirmed && (
              <div className="rounded-2xl bg-[#F0FAF5] border border-[#0F6E56]/20 p-4 flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0F6E56]">
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0F1A2E]">Agendamento realizado!</p>
                  <p className="text-xs text-black/50 mt-0.5">Você receberá uma confirmação pelo WhatsApp.</p>
                </div>
              </div>
            )}
            <button
              onClick={() => { setBookingOpen(true); setBookingConfirmed(false); }}
              className="flex items-center justify-center gap-2 w-full rounded-2xl border-2 py-3.5 text-sm font-semibold transition hover:opacity-80"
              style={{ borderColor: brandColor, color: brandColor }}
            >
              <CalendarPlus className="h-4 w-4" />
              Agendar nova consulta
            </button>
            {bookingOpen && (
              <PortalBookingModal
                sessionTypes={data.sessionTypes}
                clinicSlug={data.clinic.slug}
                rawToken={rawToken}
                brandColor={brandColor}
                onClose={() => setBookingOpen(false)}
                onSuccess={() => {
                  setBookingOpen(false);
                  setBookingConfirmed(true);
                }}
              />
            )}
          </>
        ) : bookingUrl ? (
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
        ) : null}

        {/* Mensagens com a clínica */}
        <div className="bg-white rounded-2xl border border-black/[.07] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40">Mensagens</p>
            {data.unreadClinicMessages > 0 && (
              <span
                className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: brandColor }}
              >
                <MessageCircle className="h-3 w-3" />
                {data.unreadClinicMessages} nova{data.unreadClinicMessages !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <PortalChat
            rawToken={rawToken}
            brandColor={brandColor}
            patientName={data.patient.full_name}
          />
        </div>

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
              {/* Contato */}
              <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-black/30 pt-1">Contato</p>
              <div>
                <label className="text-xs text-black/40 block mb-1">Nome completo</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome completo"
                  className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-black/40 block mb-1">Telefone / WhatsApp</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55 11 99999-9999"
                    className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
                </div>
                <div>
                  <label className="text-xs text-black/40 block mb-1">E-mail</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com"
                    className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
                </div>
              </div>
              <div>
                <label className="text-xs text-black/40 block mb-1">Data de nascimento</label>
                <input type="date" value={dob} onChange={(e) => setDob(e.target.value)}
                  className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
              </div>

              {/* Endereço */}
              <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-black/30 pt-2">Endereço</p>
              <div>
                <label className="text-xs text-black/40 block mb-1">Logradouro</label>
                <input type="text" value={addressLine} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, complemento"
                  className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-black/40 block mb-1">Cidade</label>
                  <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="São Paulo"
                    className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
                </div>
                <div>
                  <label className="text-xs text-black/40 block mb-1">Estado</label>
                  <input type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder="SP"
                    className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-black/40 block mb-1">CEP</label>
                  <input type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="00000-000"
                    className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
                </div>
                <div>
                  <label className="text-xs text-black/40 block mb-1">País</label>
                  <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Brasil"
                    className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
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
              {data.patient.date_of_birth && (
                <p className="text-sm text-[#0F1A2E]">
                  {new Date(data.patient.date_of_birth + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              )}
              {(data.patient.address_line || data.patient.city) && (
                <p className="text-sm text-black/60">
                  {[data.patient.address_line, data.patient.city, data.patient.state, data.patient.zip_code].filter(Boolean).join(", ")}
                </p>
              )}
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
