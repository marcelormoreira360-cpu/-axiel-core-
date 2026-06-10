import {
  BaseEmail,
  EmailHeading,
  EmailText,
  EmailDivider,
  EmailButton,
  type EmailT,
} from "@/components/email/base-email";

export interface TrialExpiryEmailProps {
  clinicName: string;
  /** Dias restantes de trial — apenas 3 (D-3) ou 1 (D-1). */
  daysLeft: 1 | 3;
  /** Data de término do trial, já formatada no locale do destinatário. */
  trialEndDate: string;
  /** URL absoluta do CTA (página de billing/planos). */
  ctaUrl: string;
  t: EmailT;
  locale?: string;
}

/**
 * E-mail de aviso de trial expirando, enviado ao dono da clínica em D-3 e D-1.
 * Disparado pelo cron diário via services/trial-expiry-service.ts.
 */
export function TrialExpiryEmail({
  clinicName,
  daysLeft,
  trialEndDate,
  ctaUrl,
  t,
  locale,
}: TrialExpiryEmailProps) {
  const variant = daysLeft === 1 ? "1d" : "3d";

  return (
    <BaseEmail
      clinicName={clinicName}
      previewText={t("trialExpiry.preview", { days: daysLeft })}
      t={t}
      locale={locale}
    >
      <EmailHeading>{t(`trialExpiry.heading${variant}`)}</EmailHeading>
      <EmailText>{t("trialExpiry.intro", { clinic: clinicName, date: trialEndDate })}</EmailText>
      <EmailText>{t(`trialExpiry.body${variant}`)}</EmailText>

      <EmailButton href={ctaUrl}>{t("trialExpiry.cta")}</EmailButton>

      <EmailDivider />

      <EmailText muted>{t("trialExpiry.footerAuto")}</EmailText>
    </BaseEmail>
  );
}
