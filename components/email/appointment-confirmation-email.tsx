import {
  BaseEmail,
  EmailHeading,
  EmailText,
  EmailInfoBox,
  EmailInfoRow,
  EmailDivider,
  type EmailT,
} from "./base-email";

interface Props {
  clinicName: string;
  patientFirstName: string;
  dateStr: string;   // e.g. "segunda-feira, 12 de maio"
  timeStr: string;   // e.g. "10:00"
  durationMinutes: number;
  whatsappUrl?: string | null;
  t: EmailT;
  locale?: string;
}

export function AppointmentConfirmationEmail({
  clinicName,
  patientFirstName,
  dateStr,
  timeStr,
  durationMinutes,
  whatsappUrl,
  t,
  locale,
}: Props) {
  return (
    <BaseEmail
      clinicName={clinicName}
      previewText={t("apptConfirm.preview", { date: dateStr, time: timeStr })}
      t={t}
      locale={locale}
    >
      {/* Icon + heading */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{
          display: "inline-block",
          backgroundColor: "#E1F5EE",
          borderRadius: "50%",
          width: 52,
          height: 52,
          lineHeight: "52px",
          fontSize: 24,
          textAlign: "center",
          marginBottom: 12,
        }}>
          ✅
        </div>
        <EmailHeading>{t("apptConfirm.heading")}</EmailHeading>
        <EmailText muted>{t("apptConfirm.subtitle", { name: patientFirstName })}</EmailText>
      </div>

      {/* Session details */}
      <EmailInfoBox>
        <EmailInfoRow label={t("rowDate")} value={dateStr} />
        <EmailInfoRow label={t("rowTime")} value={timeStr} />
        <EmailInfoRow label={t("rowDuration")} value={t("minutes", { n: durationMinutes })} />
        <EmailInfoRow label={t("rowClinic")} value={clinicName} />
      </EmailInfoBox>

      <EmailDivider />

      <EmailText>
        {t("apptConfirm.rescheduleQ")}
        {whatsappUrl
          ? t.rich("apptConfirm.rescheduleWhats", {
              a: (c: React.ReactNode) => <a href={whatsappUrl} style={{ color: "#0F6E56", fontWeight: 600 }}>{c}</a>,
            })
          : t("apptConfirm.rescheduleNoWhats")}
      </EmailText>

      <EmailText muted>{t("apptConfirm.seeYou")}</EmailText>
    </BaseEmail>
  );
}
