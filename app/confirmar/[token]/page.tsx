import type { Metadata } from "next";
import { cache } from "react";
import { getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { getAppointmentByConfirmToken } from "@/services/appointment-service";
import { getClinicTimezone } from "@/services/clinic-service";
import { resolvePatientTimezone } from "@/lib/timezone";
import type { TemplateWithStructure } from "@/lib/types";
import { pickSessionTypeName } from "@/services/session-type-service";
import { resolveLocale } from "@/i18n/get-locale";
import { isLocale, type Locale } from "@/i18n/locales";
import enConfirm from "@/messages/en/confirmBooking.json";
import ptBRConfirm from "@/messages/pt-BR/confirmBooking.json";
import ptPTConfirm from "@/messages/pt-PT/confirmBooking.json";
import { ConfirmClient } from "./confirm-client";

export const dynamic = "force-dynamic";

const CONFIRM_MESSAGES: Record<Locale, typeof ptBRConfirm> = {
  "pt-BR": ptBRConfirm,
  en: enConfirm,
  "pt-PT": ptPTConfirm,
};

// Dedup por request: metadata + page compartilham a mesma consulta ao agendamento.
const getInfo = cache(getAppointmentByConfirmToken);

/**
 * Idioma FIXO pelo link: a página de confirmação abre no idioma do paciente do
 * agendamento (patients.locale), independente do cookie/navegador de quem abre
 * o link (mesmo princípio dos formulários públicos /f). Assim o link enviado a
 * um paciente americano abre em inglês mesmo que quem clicou tenha o navegador
 * em português. Sem locale do paciente, cai no comportamento antigo
 * (cookie -> Accept-Language -> default).
 */
async function localeForToken(token: string): Promise<Locale> {
  const info = await getInfo(token);
  const patientLocale = info?.patient?.locale;
  return isLocale(patientLocale) ? patientLocale : await resolveLocale();
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const locale = await localeForToken(token);
  const t = await getTranslations({ locale, namespace: "confirmBooking" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

const TERMINAL_STATUSES = ["completed", "no_show", "cancelled", "cancelled_notice", "late_cancel", "checked_in"];

export default async function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await getInfo(token);
  const locale = await localeForToken(token);
  // Fuso da clínica + fuso do paciente (salvo/inferido) para exibição dupla.
  const timezone = info?.clinic_id ? await getClinicTimezone(info.clinic_id) : "UTC";
  const patientTimezone = resolvePatientTimezone({
    stored: info?.patient?.timezone,
    country: info?.patient?.country,
    phone: info?.patient?.phone,
    fallback: timezone,
  });

  // Modo da tela:
  //  invalid → link morto/expirado.  confirm → pendente (form + opção cancelar).
  //  manage  → já confirmado/agendado no futuro (mostra confirmado + cancelar).
  //  closed  → estado terminal ou horário já passado (mensagem calorosa).
  const status = info?.status ?? null;
  const isPast = info ? new Date(info.starts_at).getTime() < Date.now() : false;
  let mode: "invalid" | "confirm" | "manage" | "closed";
  if (!info || info.expired) mode = "invalid";
  else if (status === "pending" && !isPast) mode = "confirm";
  else if ((status === "confirmed" || status === "scheduled") && !isPast) mode = "manage";
  else mode = TERMINAL_STATUSES.includes(status ?? "") || isPast ? "closed" : "invalid";

  // Questionário-PRIMEIRO: só no modo de confirmação (pendente).
  let questionnaires: TemplateWithStructure[] = [];
  if (mode === "confirm" && info?.patient?.id) {
    const { getOnboardingTemplatesForPatient } = await import("@/services/onboarding-assessment-service");
    questionnaires = await getOnboardingTemplatesForPatient({ clinicId: info.clinic_id, patientId: info.patient.id });
  }

  // Aceite da política de no-show pelo LINK DE CONFIRMAÇÃO (source='confirm_link').
  // Igual ao booking web: só aparece quando a clínica cobra falta/cancelamento tardio.
  // O texto renderizado (imutável/versionado) é serializável e vai pronto para o client.
  let policy: import("@/modules/no-show-policy/policy-text").RenderedNoShowPolicy | null = null;
  if (mode === "confirm" && info) {
    const { getClinicPolicyPresentation } = await import("@/services/no-show-policy-presentation");
    const pres = await getClinicPolicyPresentation(info.clinic_id);
    if (pres.clinicCharges) {
      const { getNoShowPolicyText } = await import("@/modules/no-show-policy/policy-text");
      policy = getNoShowPolicyText(locale, pres.config);
    }
  }

  return (
    <NextIntlClientProvider locale={locale} messages={{ confirmBooking: CONFIRM_MESSAGES[locale] }}>
      <ConfirmClient
        token={token}
        mode={mode}
        clinicName={info?.clinic?.name ?? null}
        logoUrl={info?.clinic?.logo_url ?? null}
        primaryColor={info?.clinic?.primary_color ?? "#0B1F3A"}
        startsAt={info?.starts_at ?? null}
        durationMinutes={info?.duration_minutes ?? null}
        sessionTypeName={info?.session_type_name ? pickSessionTypeName(info.session_type_name, info.session_type_name_i18n, locale) : null}
        patientName={info?.patient?.full_name ?? ""}
        patientEmail={info?.patient?.email ?? ""}
        patientPhone={info?.patient?.phone ?? ""}
        timezone={timezone}
        patientTimezone={patientTimezone}
        intakeForms={questionnaires}
        policy={policy}
      />
    </NextIntlClientProvider>
  );
}
