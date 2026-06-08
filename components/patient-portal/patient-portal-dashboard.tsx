"use client";

import Link from "next/link";
import { useState, useTransition, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { FileUp, FileText, Image, Pencil, Check, X, CalendarPlus, MessageCircle, ChevronDown, ChevronUp, Receipt, Trash2 } from "lucide-react";
import { type PatientPortalData } from "@/services/patient-portal-service";
import { useFormatMoney } from "@/components/currency-provider";
import { formatIntakeAnswerSummary } from "@/lib/intake-answer";
import { PackagesSection } from "./packages-section";
import { PortalBookingModal } from "./portal-booking-modal";
import { NpsWidget } from "./nps-widget";
import { PortalChat } from "./portal-chat";
import { uploadPortalDocumentAction, updatePatientContactAction, cancelPortalAppointmentAction, requestDataDeletionAction } from "@/app/p/[token]/actions";

type DashT = (k: string, v?: Record<string, string | number>) => string;

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(locale, { day: "numeric", month: "short" });
}

function formatDateTime(value: string | null | undefined, locale: string, at: string) {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })} ${at} ${d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`;
}

function shortText(value: string | null | undefined, fallback: string, max = 180) {
  const clean = value?.trim();
  if (!clean) return fallback;
  return clean.length > max ? `${clean.slice(0, max - 3)}…` : clean;
}

function SubscriptionCard({
  sub,
  brandColor,
}: {
  sub: NonNullable<PatientPortalData["activeSubscription"]>;
  brandColor: string;
}) {
  const t = useTranslations("portal.dashboard");
  const locale = useLocale();
  const fmt = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: sub.currency }).format(cents / 100);

  const renewsAt = sub.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString(locale, { day: "numeric", month: "short" })
    : null;

  const statusConfig: Record<string, { labelKey: string; color: string }> = {
    active:    { labelKey: "statusActive",     color: "#0F6E56" },
    trialing:  { labelKey: "statusTrialing",   color: "#3B82F6" },
    past_due:  { labelKey: "statusPastDue",    color: "#F59E0B" },
    paused:    { labelKey: "statusPaused",     color: "#6B7280" },
    canceled:  { labelKey: "statusCanceled",   color: "#EF4444" },
    incomplete: { labelKey: "statusIncomplete", color: "#F59E0B" },
  };
  const cfg = statusConfig[sub.status];
  const st = { label: cfg ? t(cfg.labelKey) : sub.status, color: cfg?.color ?? "#6B7280" };

  const sessionsLeft = sub.sessionsPerCycle > 0 ? sub.sessionsPerCycle - sub.sessionsUsedThisCycle : null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#0F1A2E]">{sub.planName}</p>
          <p className="text-xs text-black/45 mt-0.5">
            {fmt(sub.amountCents)} / {sub.billingInterval === "yearly" ? t("perYear") : t("perMonth")}
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
            <p className="text-xs text-black/50">{t("sessionsThisCycle")}</p>
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
            {t("sessionsLeftCycle", { count: sessionsLeft })}
          </p>
        </div>
      )}

      {renewsAt && !sub.cancelAtPeriodEnd && sub.status !== "canceled" && (
        <p className="text-xs text-black/35 mt-2">
          {sub.status === "past_due" ? t("renewPendingDate", { date: renewsAt }) : t("renewDate", { date: renewsAt })}
        </p>
      )}
      {sub.cancelAtPeriodEnd && renewsAt && (
        <p className="text-xs text-amber-500 mt-2">{t("cancelsOn", { date: renewsAt })}</p>
      )}
      {sub.status === "past_due" && (
        <p className="text-xs text-amber-600 mt-2 font-medium">
          {t("pastDueWarning")}
        </p>
      )}
    </div>
  );
}

function CancelAppointmentButton({
  appointmentId,
  rawToken,
  brandColor,
}: {
  appointmentId: string;
  rawToken: string;
  brandColor: string;
}) {
  const t = useTranslations("portal.dashboard");
  const [confirming, setConfirming] = useState(false);
  const [loading, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return <span className="shrink-0 text-xs text-red-500">{t("apptCanceled")}</span>;
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="shrink-0 text-[10px] text-black/30 hover:text-red-500 transition px-2 py-1 rounded border border-black/[.06] hover:border-red-200"
      >
        {t("cancel")}
      </button>
    );
  }

  return (
    <div className="shrink-0 flex items-center gap-1.5">
      <span className="text-[10px] text-black/50">{t("confirmQ")}</span>
      <button
        type="button"
        onClick={() => {
          startTransition(async () => {
            const result = await cancelPortalAppointmentAction(rawToken, appointmentId);
            if (result.ok) {
              setDone(true);
            } else {
              setError(result.error);
              setConfirming(false);
            }
          });
        }}
        disabled={loading}
        className="text-[10px] font-medium text-red-600 border border-red-200 hover:bg-red-50 px-2 py-1 rounded transition disabled:opacity-50"
      >
        {loading ? "…" : t("yes")}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-[10px] text-black/40 border border-black/[.08] hover:bg-black/[.03] px-2 py-1 rounded transition"
      >
        {t("no")}
      </button>
      {error && <span className="text-[10px] text-red-500 ml-1">{error}</span>}
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
  const t = useTranslations("portal.dashboard");
  const money = useFormatMoney();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formatted = money(priceCents);

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
      if (!res.ok) { setError(data.error ?? t("errStart")); return; }
      window.location.href = data.url;
    } catch {
      setError(t("errConn"));
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
        {loading ? "…" : t("pay", { amount: formatted })}
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
  const t = useTranslations("portal.dashboard");
  const locale = useLocale();
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
              <span className="text-sm font-medium text-[#0F1A2E]">{t("sessionNum", { number: sessionNumber })}</span>
              <span className="text-xs text-black/40">{formatDate(session.starts_at, locale)}</span>
              {session.session_type_name && (
                <span className="text-[10px] bg-black/[.05] text-black/45 rounded-full px-2 py-0.5">
                  {session.session_type_name}
                </span>
              )}
              {session.duration_minutes > 0 && (
                <span className="text-[10px] text-black/30">{session.duration_minutes} {t("minUnit")}</span>
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
            <span className="text-xs font-medium text-[#0F6E56]">{t("paid")}</span>
          )}
          {session.payment_status === "covered" && (
            <span className="text-xs text-black/40">{t("packageLabel")}</span>
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
          <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-black/35 mb-1">{t("obsTitle")}</p>
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

function LgpdSection({ rawToken }: { rawToken: string }) {
  const t = useTranslations("portal.dashboard");
  const [requested, setRequested] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [loading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (requested) {
    return (
      <p className="text-sm text-[#0F6E56]">
        {t("lgpdRequested")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-black/60 leading-relaxed">
        {t("lgpdText")}
      </p>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-sm text-red-500 hover:text-red-700 underline transition"
        >
          {t("requestDeletion")}
        </button>
      ) : (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-red-800">
            {t("lgpdConfirmText")}
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                startTransition(async () => {
                  const result = await requestDataDeletionAction(rawToken);
                  if (result.ok) {
                    setRequested(true);
                  } else {
                    setError(result.error);
                  }
                });
              }}
              className="text-sm font-medium text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition disabled:opacity-50"
            >
              {loading ? t("sending") : t("confirmRequest")}
            </button>
            <button
              type="button"
              onClick={() => { setConfirming(false); setError(null); }}
              className="text-sm text-black/50 hover:text-black/70 px-4 py-2 rounded-lg border border-black/10 transition"
            >
              {t("cancel")}
            </button>
          </div>
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
  const t = useTranslations("portal.dashboard");
  const locale = useLocale();
  const firstName = data.patient.full_name.split(" ")[0];
  const nextSession = data.upcomingAppointments[0];
  const pkg = data.activePackage;
  const pkgPercent = pkg ? Math.round((pkg.sessions_used / pkg.sessions_total) * 100) : 0;
  const brandColor = data.clinic.primary_color ?? "#0B1F3A";

  // Self-booking modal state
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  // Session history expand state
  const [showAllSessions, setShowAllSessions] = useState(false);
  const SESSION_PREVIEW = 5;

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
  const [contactErrored, setContactErrored] = useState(false);
  const [, startContactTransition] = useTransition();

  // Document upload state
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadErrored, setUploadErrored] = useState(false);
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
      setUploadErrored(false);
      setUploadMsg(t("uploadSuccess"));
      setDocuments((prev) => [
        { id: crypto.randomUUID(), file_name: file.name, file_type: file.type.startsWith("image") ? "image" : file.type === "application/pdf" ? "pdf" : "other", source: "portal", created_at: new Date().toISOString() },
        ...prev,
      ]);
    } else {
      setUploadErrored(true);
      setUploadMsg(result.error ?? t("uploadErr"));
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
        setContactErrored(false);
        setContactMsg(t("contactSaved"));
        setEditingContact(false);
      } else {
        setContactErrored(true);
        setContactMsg(result.error ?? t("saveErr"));
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
            {t("greeting", { name: firstName })}
          </h1>
          <p className="mt-1 text-sm text-black/50">{t("subtitle")}</p>
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
              <p className="text-sm font-semibold text-[#0F1A2E]">{t("paymentTitle")}</p>
              <p className="text-xs text-black/50 mt-0.5">{t("paymentDesc")}</p>
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
              <p className="text-sm font-semibold text-[#0F1A2E]">{t("purchaseTitle")}</p>
              <p className="text-xs text-black/50 mt-0.5">{t("purchaseDesc")}</p>
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
              <p className="text-sm font-semibold text-[#0F1A2E]">{t("subTitle")}</p>
              <p className="text-xs text-black/50 mt-0.5">{t("subDesc")}</p>
            </div>
          </div>
        )}

        {/* Próxima sessão */}
        {nextSession ? (
          <div className="rounded-2xl p-5 text-white" style={{ backgroundColor: brandColor }}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50 mb-2">{t("nextSession")}</p>
            <p className="text-lg font-semibold">{formatDateTime(nextSession.starts_at, locale, t("at"))}</p>
            {nextSession.duration_minutes && (
              <p className="text-sm text-white/60 mt-1">{t("minutes", { count: nextSession.duration_minutes })}</p>
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
              <p className="mt-3 text-xs font-medium text-white/70">{t("sessionPaid")}</p>
            )}
            {nextSession.payment_status === "covered" && (
              <p className="mt-3 text-xs font-medium text-white/70">{t("coveredByPackage")}</p>
            )}
            {nextSession.zoom_join_url && (
              <a
                href={nextSession.zoom_join_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex items-center gap-2 w-full justify-center rounded-xl py-2.5 text-sm font-semibold transition"
                style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15 10.5v3l4-3v6l-4-3v3a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1h10a1 1 0 011 1v3.5z"/>
                </svg>
                {t("joinTelehealth")}
              </a>
            )}
            {data.whatsappUrl && (
              <Link
                href={data.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block text-xs font-medium text-white/70 hover:text-white underline underline-offset-2 transition"
              >
                {t("requestReschedule")}
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-black/[.07] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40 mb-2">{t("nextSession")}</p>
            <p className="text-sm text-black/50">{t("noSession")}</p>
            {data.whatsappUrl && (
              <Link
                href={data.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm font-medium text-[#0F6E56] hover:underline"
              >
                {t("bookViaWhatsapp")}
              </Link>
            )}
          </div>
        )}

        {/* Pacote ativo */}
        {pkg && (
          <Section title={t("yourPackage")}>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-[#0F1A2E]">{pkg.name}</p>
                <p className="text-sm font-medium text-[#0F6E56]">
                  {t("sessionsRemaining", { count: pkg.sessions_remaining })}
                </p>
              </div>
              <div className="h-2 bg-black/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0F6E56] rounded-full transition-all"
                  style={{ width: `${pkgPercent}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-black/40">
                {t("sessionsUsed", { used: pkg.sessions_used, total: pkg.sessions_total })}
              </p>
            </div>
          </Section>
        )}

        {/* Assinatura ativa */}
        {data.activeSubscription && (
          <Section title={t("myPlan")}>
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
          <Section title={t("yourProgress")}>
            <div>
              <p className="text-base font-semibold text-[#0F1A2E]">{data.latestInsight.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-black/60">
                {shortText(data.latestInsight.summary, t("placeholderUpdate"), 200)}
              </p>
            </div>
            <div className="bg-[#F0FAF5] rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0F6E56]/70 mb-1">{t("nextStep")}</p>
              <p className="text-sm leading-relaxed text-[#0F1A2E]">
                {shortText(data.nextStep, t("placeholderUpdate"), 160)}
              </p>
            </div>
          </Section>
        )}

        {/* Todos os insights aprovados */}
        {data.allInsights.length > 1 && (
          <Section title={t("healthJourney")}>
            <div className="space-y-3">
              {data.allInsights.map((ins, i) => (
                <div key={ins.id} className="border-b border-black/[.05] pb-3 last:border-0 last:pb-0">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#0F6E56] mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-[#0F1A2E]">{ins.title}</p>
                        <span className="text-[10px] text-black/30">
                          {ins.approved_at
                            ? new Date(ins.approved_at).toLocaleDateString(locale, { month: "short", year: "numeric" })
                            : new Date(ins.created_at).toLocaleDateString(locale, { month: "short", year: "numeric" })}
                        </span>
                      </div>
                      {i === 0 && (
                        <p className="text-xs text-[#0F6E56] font-medium mt-0.5">{t("mostRecent")}</p>
                      )}
                      <p className="text-xs text-black/55 leading-relaxed mt-1 line-clamp-2">{ins.summary}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Exames laboratoriais */}
        {data.exams.length > 0 && (
          <Section title={t("examsTitle")}>
            <div className="space-y-3">
              {data.exams.map((exam) => (
                <div key={exam.id} className="border-b border-black/[.05] pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-semibold text-[#0F1A2E]">
                      {exam.lab_name ?? t("examDefault")}
                    </p>
                    <span className="text-xs text-black/35">
                      {new Date(exam.exam_date).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  {exam.results.length > 0 && (
                    <div className="space-y-1">
                      {exam.results.slice(0, 4).map((r, i) => {
                        const statusColor = r.status === "high" ? "text-red-500" : r.status === "low" ? "text-amber-500" : "text-[#0F6E56]";
                        return (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-black/55">{r.biomarker}</span>
                            <span className={`font-medium ${statusColor}`}>
                              {r.value} {r.unit ?? ""}
                            </span>
                          </div>
                        );
                      })}
                      {exam.results.length > 4 && (
                        <p className="text-[10px] text-black/30">{t("moreMarkers", { count: exam.results.length - 4 })}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Prescrições e suplementos ativos */}
        {data.activePrescriptions.length > 0 && (
          <Section title={t("protocolTitle")}>
            <div className="space-y-2">
              {data.activePrescriptions.map((p) => (
                <div key={p.id} className="flex items-start gap-2.5 py-1.5 border-b border-black/[.05] last:border-0">
                  <div
                    className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.type === "medication" ? "#4F46E5" : "#0F6E56" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-[#0F1A2E]">{p.name}</p>
                      <span className="text-[10px] bg-black/[.05] text-black/40 rounded-full px-1.5 py-0.5">
                        {p.type === "medication" ? t("medication") : t("supplement")}
                      </span>
                    </div>
                    {(p.dosage || p.frequency) && (
                      <p className="text-xs text-black/45 mt-0.5">
                        {[p.dosage, p.frequency].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {p.end_date && (
                      <p className="text-[10px] text-black/30 mt-0.5">
                        {t("until", { date: new Date(p.end_date).toLocaleDateString(locale, { day: "numeric", month: "short" }) })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Histórico de sessões */}
        {data.sessions.length > 0 && (
          <Section title={t("historyTitle")}>
            <div className="space-y-1">
              {(showAllSessions ? data.sessions : data.sessions.slice(0, SESSION_PREVIEW)).map((session, index) => (
                <SessionHistoryCard
                  key={session.id ?? index}
                  session={session}
                  sessionNumber={data.sessions.length - index}
                  rawToken={rawToken}
                  brandColor={brandColor}
                />
              ))}
            </div>
            {data.sessions.length > SESSION_PREVIEW && (
              <button
                type="button"
                onClick={() => setShowAllSessions((v) => !v)}
                className="mt-1 text-xs text-black/40 hover:text-black/70 transition underline underline-offset-2"
              >
                {showAllSessions
                  ? t("viewLess")
                  : t("viewMoreSessions", { count: data.sessions.length - SESSION_PREVIEW })}
              </button>
            )}
          </Section>
        )}

        {/* Histórico de pagamentos */}
        {data.paymentHistory.length > 0 && (
          <Section title={t("paymentsTitle")}>
            <div className="space-y-0 divide-y divide-black/[.05]">
              {data.paymentHistory.map((payment) => {
                const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: payment.currency }).format(payment.amount_cents / 100);
                const paidDate = payment.paid_at
                  ? new Date(payment.paid_at).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })
                  : "—";
                const label = payment.description ?? (payment.appointment_id ? t("paymentDefaultSession") : t("paymentDefault"));
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
          <Section title={t("upcomingTitle")}>
            <div className="space-y-2">
              {data.upcomingAppointments.map((appt, index) => (
                <div
                  key={appt.id ?? index}
                  className="flex items-start justify-between py-2 border-b border-black/[.05] last:border-0 gap-2"
                >
                  <div>
                    <span className="text-sm text-[#0F1A2E]">{formatDateTime(appt.starts_at, locale, t("at"))}</span>
                    {appt.duration_minutes && (
                      <span className="ml-2 text-xs text-black/40">{appt.duration_minutes} {t("minUnit")}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {appt.zoom_join_url && (
                      <a
                        href={appt.zoom_join_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[11px] font-semibold text-white bg-[#0078D4] hover:bg-[#006BBE] px-2.5 py-1 rounded-lg transition"
                      >
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M15 10.5v3l4-3v6l-4-3v3a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1h10a1 1 0 011 1v3.5z"/>
                        </svg>
                        Zoom
                      </a>
                    )}
                    {appt.payment_status === "pending" && (
                      <PaySessionButton
                        appointmentId={appt.id}
                        priceCents={appt.price_cents}
                        rawToken={rawToken}
                        brandColor={brandColor}
                      />
                    )}
                    {appt.payment_status === "paid" && (
                      <span className="shrink-0 text-xs font-medium text-[#0F6E56]">{t("paid")}</span>
                    )}
                    {appt.payment_status === "covered" && (
                      <span className="shrink-0 text-xs text-black/40">{t("packageLabel")}</span>
                    )}
                    <CancelAppointmentButton
                      appointmentId={appt.id}
                      rawToken={rawToken}
                      brandColor={brandColor}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Questionários pendentes */}
        {data.pendingAssessments.length > 0 && (
          <Section title={t("pendingAssessmentsTitle")}>
            <ul className="space-y-2">
              {data.pendingAssessments.map((q, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm text-[#0F1A2E]">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  {q.name}
                </li>
              ))}
            </ul>
            <p className="text-xs text-black/40 mt-3">{t("pendingAssessmentsHint")}</p>
          </Section>
        )}

        {/* Sua evolução nos questionários */}
        {data.assessmentProgress.some((p) => p.count > 0) && (
          <Section title={t("progressTitle")}>
            <div className="space-y-4">
              {data.assessmentProgress.filter((p) => p.count > 0).map((p, idx) => {
                const max = Math.max(...p.points.map((pt) => pt.score_percentage), 1);
                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-[#0F1A2E]">{p.template_name}</span>
                      {p.count > 1 && <span className="text-xs text-black/40">{p.baseline}% → {p.latest}%</span>}
                    </div>
                    <div className="flex items-end gap-1.5 h-14">
                      {p.points.map((pt, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                          <div
                            className="w-full rounded-t bg-[#0F6E56]/70"
                            style={{ height: `${Math.max(4, Math.round((pt.score_percentage / max) * 44))}px` }}
                            title={`${pt.score_percentage}%`}
                          />
                          <span className="text-[9px] text-black/35">{new Date(pt.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-black/40 mt-3">{t("progressHint")}</p>
          </Section>
        )}

        {/* Informações de saúde (intake) */}
        {data.intakeResponses.length > 0 && (
          <Section title={t("healthInfoTitle")}>
            <div className="space-y-3">
              {data.intakeResponses.map((item, idx) => (
                <div key={idx} className="border-b border-black/[.05] pb-3 last:border-0 last:pb-0">
                  <p className="text-xs font-semibold text-black/40 mb-0.5">{item.label}</p>
                  <p className="text-sm text-[#0F1A2E]">{formatIntakeAnswerSummary(item.answer)}</p>
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
                  <p className="text-sm font-semibold text-[#0F1A2E]">{t("bookingDoneTitle")}</p>
                  <p className="text-xs text-black/50 mt-0.5">{t("bookingDoneDesc")}</p>
                </div>
              </div>
            )}
            <button
              onClick={() => { setBookingOpen(true); setBookingConfirmed(false); }}
              className="flex items-center justify-center gap-2 w-full rounded-2xl border-2 py-3.5 text-sm font-semibold transition hover:opacity-80"
              style={{ borderColor: brandColor, color: brandColor }}
            >
              <CalendarPlus className="h-4 w-4" />
              {t("bookNew")}
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
            {t("bookNew")}
          </a>
        ) : null}

        {/* Mensagens com a clínica */}
        <div className="bg-white rounded-2xl border border-black/[.07] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40">{t("messagesTitle")}</p>
            {data.unreadClinicMessages > 0 && (
              <span
                className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: brandColor }}
              >
                <MessageCircle className="h-3 w-3" />
                {t("newMessages", { count: data.unreadClinicMessages })}
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40">{t("documentsTitle")}</p>
            <label className="flex items-center gap-1.5 cursor-pointer rounded-xl border border-black/[.10] px-3 py-1.5 text-xs font-medium text-black/60 hover:bg-black/[.04] transition">
              <FileUp className="h-3.5 w-3.5" />
              {uploading ? t("uploading") : t("uploadFile")}
              <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
          {uploadMsg && (
            <p className={`text-xs ${uploadErrored ? "text-red-500" : "text-[#0F6E56]"}`}>
              {uploadMsg}
            </p>
          )}
          {documents.length === 0 ? (
            <p className="text-sm text-black/40">{t("noDocuments")}</p>

          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-2 py-1.5 border-b border-black/[.05] last:border-0">
                  {FILE_TYPE_ICON[doc.file_type] ?? <FileText className="h-4 w-4 text-black/30" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#0F1A2E] truncate">{doc.file_name}</p>
                    <p className="text-xs text-black/30">{new Date(doc.created_at).toLocaleDateString(locale)}</p>
                  </div>
                  {doc.source === "portal" && (
                    <span className="text-[10px] text-black/30">{t("docYou")}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Meus dados */}
        <div className="bg-white rounded-2xl border border-black/[.07] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40">{t("myDataTitle")}</p>
            {!editingContact && (
              <button onClick={() => setEditingContact(true)} className="flex items-center gap-1 text-xs text-black/40 hover:text-black/70 transition">
                <Pencil className="h-3 w-3" /> {t("edit")}
              </button>
            )}
          </div>
          {contactMsg && (
            <p className={`text-xs ${contactErrored ? "text-red-500" : "text-[#0F6E56]"}`}>{contactMsg}</p>
          )}
          {editingContact ? (
            <div className="space-y-2">
              {/* Contato */}
              <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-black/30 pt-1">{t("contactSection")}</p>
              <div>
                <label className="text-xs text-black/40 block mb-1">{t("fullName")}</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("fullNamePlaceholder")}
                  className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-black/40 block mb-1">{t("phone")}</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55 11 99999-9999"
                    className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
                </div>
                <div>
                  <label className="text-xs text-black/40 block mb-1">{t("email")}</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("emailPlaceholder")}
                    className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
                </div>
              </div>
              <div>
                <label className="text-xs text-black/40 block mb-1">{t("dob")}</label>
                <input type="date" value={dob} onChange={(e) => setDob(e.target.value)}
                  className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
              </div>

              {/* Endereço */}
              <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-black/30 pt-2">{t("addressSection")}</p>
              <div>
                <label className="text-xs text-black/40 block mb-1">{t("addressLine")}</label>
                <input type="text" value={addressLine} onChange={(e) => setAddress(e.target.value)} placeholder={t("addressPlaceholder")}
                  className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-black/40 block mb-1">{t("city")}</label>
                  <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("cityPlaceholder")}
                    className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
                </div>
                <div>
                  <label className="text-xs text-black/40 block mb-1">{t("stateLabel")}</label>
                  <input type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder={t("statePlaceholder")}
                    className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-black/40 block mb-1">{t("zip")}</label>
                  <input type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder={t("zipPlaceholder")}
                    className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
                </div>
                <div>
                  <label className="text-xs text-black/40 block mb-1">{t("country")}</label>
                  <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder={t("countryPlaceholder")}
                    className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-black/30" />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={handleSaveContact} className="flex items-center gap-1 rounded-xl bg-[#0F1A2E] text-white px-4 py-2 text-sm font-medium hover:bg-black transition">
                  <Check className="h-3.5 w-3.5" /> {t("save")}
                </button>
                <button onClick={() => { setEditingContact(false); setContactMsg(null); }} className="flex items-center gap-1 rounded-xl border border-black/[.10] px-4 py-2 text-sm text-black/50 hover:bg-black/[.04] transition">
                  <X className="h-3.5 w-3.5" /> {t("cancel")}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-[#0F1A2E]">{data.patient.full_name}</p>
              <p className="text-sm text-[#0F1A2E]">{data.patient.phone || <span className="text-black/30 italic">{t("phoneNotInformed")}</span>}</p>
              <p className="text-sm text-[#0F1A2E]">{data.patient.email || <span className="text-black/30 italic">{t("emailNotInformed")}</span>}</p>
              {data.patient.date_of_birth && (
                <p className="text-sm text-[#0F1A2E]">
                  {new Date(data.patient.date_of_birth + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })}
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
            {t("talkWhatsapp")}
          </Link>
        )}

        {/* LGPD — Seus dados */}
        <Section title={t("privacyTitle")}>
          <LgpdSection rawToken={rawToken} />
        </Section>

        <p className="text-center text-xs text-black/30">
          {t("privateNote")}
        </p>
        <p className="pb-4 text-center text-[11px] text-black/25 leading-relaxed">
          {t.rich("lgpdFooter", {
            a: (c) => <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="underline hover:text-black/40 transition">{c}</a>,
          })}
        </p>
      </div>
    </div>
  );
}
