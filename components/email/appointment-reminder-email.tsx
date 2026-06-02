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
  dateStr: string;
  timeStr: string;
  durationMinutes: number;
  daysUntil: number;    // 1 = tomorrow, 0 = today
  whatsappUrl?: string | null;
  t: EmailT;
  locale?: string;
}

export function AppointmentReminderEmail({
  clinicName,
  patientFirstName,
  dateStr,
  timeStr,
  durationMinutes,
  daysUntil,
  whatsappUrl,
  t,
  locale,
}: Props) {
  const when = daysUntil === 0 ? t("apptReminder.whenToday") : daysUntil === 1 ? t("apptReminder.whenTomorrow") : t("apptReminder.whenDays", { n: daysUntil });
  const emoji = daysUntil <= 1 ? "⏰" : "📅";

  return (
    <BaseEmail
      clinicName={clinicName}
      previewText={t("apptReminder.preview", { when, time: timeStr })}
      t={t}
      locale={locale}
    >
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{
          display: "inline-block",
          backgroundColor: "#FAEEDA",
          borderRadius: "50%",
          width: 52,
          height: 52,
          lineHeight: "52px",
          fontSize: 24,
          textAlign: "center",
          marginBottom: 12,
        }}>
          {emoji}
        </div>
        <EmailHeading>{t("apptReminder.heading")}</EmailHeading>
        <EmailText muted>
          {t.rich("apptReminder.subtitle", { name: patientFirstName, when, b: (c: React.ReactNode) => <strong>{c}</strong> })}
        </EmailText>
      </div>

      <EmailInfoBox>
        <EmailInfoRow label={t("rowDate")} value={dateStr} />
        <EmailInfoRow label={t("rowTime")} value={timeStr} />
        <EmailInfoRow label={t("rowDuration")} value={t("minutes", { n: durationMinutes })} />
        <EmailInfoRow label={t("rowClinic")} value={clinicName} />
      </EmailInfoBox>

      <EmailDivider />

      <EmailText>
        {t("apptReminder.cancelNote")}
        {whatsappUrl && (
          <>
            {" "}
            <a href={whatsappUrl} style={{ color: "#0F6E56", fontWeight: 600 }}>
              {t("apptReminder.whatsCta")}
            </a>
          </>
        )}
      </EmailText>

      <EmailText muted>{t("apptReminder.seeYou")}</EmailText>
    </BaseEmail>
  );
}
