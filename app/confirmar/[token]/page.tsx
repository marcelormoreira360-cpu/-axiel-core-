import type { Metadata } from "next";
import { cache } from "react";
import { getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { getAppointmentByConfirmToken } from "@/services/appointment-service";
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

export default async function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await getInfo(token);
  const locale = await localeForToken(token);
  const invalid = !info || info.status !== "pending" || info.expired;

  return (
    <NextIntlClientProvider locale={locale} messages={{ confirmBooking: CONFIRM_MESSAGES[locale] }}>
      <ConfirmClient
        token={token}
        invalid={invalid}
        clinicName={info?.clinic?.name ?? null}
        logoUrl={info?.clinic?.logo_url ?? null}
        primaryColor={info?.clinic?.primary_color ?? "#0B1F3A"}
        startsAt={info?.starts_at ?? null}
        durationMinutes={info?.duration_minutes ?? null}
        sessionTypeName={info?.session_type_name ?? null}
        patientName={info?.patient?.full_name ?? ""}
        patientEmail={info?.patient?.email ?? ""}
        patientPhone={info?.patient?.phone ?? ""}
      />
    </NextIntlClientProvider>
  );
}
