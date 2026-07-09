"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Receipt, MessageCircle } from "lucide-react";
import { type PatientPortalData } from "@/services/patient-portal-service";
import { PoweredByAxiel } from "@/components/powered-by-axiel";
import { formatIntakeAnswerSummary } from "@/lib/intake-answer";
import { PackagesSection } from "./packages-section";
import { NpsWidget } from "./nps-widget";
import { PortalChat } from "./portal-chat";
import { shortText, Section } from "./portal-ui";
import { SubscriptionCard } from "./subscription-card";
import { PortalSuccessBanners } from "./status-banners";
import { NextSessionCard } from "./next-session-card";
import { SessionsHistorySection } from "./sessions-history-section";
import { UpcomingAppointmentsSection } from "./upcoming-appointments-section";
import { BookingCta } from "./booking-cta";
import { DocumentsSection } from "./documents-section";
import { ContactSection } from "./contact-section";
import { LgpdSection } from "./lgpd-section";

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

  // NPS feedback state
  // The session to rate: most recent past session that hasn't been rated yet
  const [ratingDismissed, setRatingDismissed] = useState(false);
  const sessionToRate = !ratingDismissed
    ? data.sessions.find((s) => !s.has_feedback) ?? null
    : null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const bookingUrl = data.clinic.slug ? `${appUrl}/book/${data.clinic.slug}` : null;

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

        {/* Banners de pagamento / compra / assinatura */}
        <PortalSuccessBanners
          paymentSuccess={paymentSuccess}
          purchaseSuccess={purchaseSuccess}
          subscriptionSuccess={subscriptionSuccess}
        />

        {/* Próxima sessão */}
        <NextSessionCard
          nextSession={nextSession}
          whatsappUrl={data.whatsappUrl}
          rawToken={rawToken}
          brandColor={brandColor}
        />

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
          <SessionsHistorySection
            sessions={data.sessions}
            rawToken={rawToken}
            brandColor={brandColor}
          />
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
          <UpcomingAppointmentsSection
            appointments={data.upcomingAppointments}
            rawToken={rawToken}
            brandColor={brandColor}
          />
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
        <BookingCta
          sessionTypes={data.sessionTypes}
          clinicSlug={data.clinic.slug}
          rawToken={rawToken}
          brandColor={brandColor}
          bookingUrl={bookingUrl}
        />

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
        <DocumentsSection initialDocuments={data.documents} rawToken={rawToken} />

        {/* Meus dados */}
        <ContactSection patient={data.patient} rawToken={rawToken} />

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

        {/* Rodapé PLG — oculto para clínicas Enterprise com white_label */}
        {data.clinic.show_powered_by !== false && (
          <PoweredByAxiel variant="portal" locale={locale} />
        )}
      </div>
    </div>
  );
}
