import {
  BaseEmail,
  EmailHeading,
  EmailText,
  EmailButton,
  EmailDivider,
  type EmailT,
} from "./base-email";

interface Props {
  clinicName: string;
  patientFirstName: string;
  portalUrl?: string | null;
  t: EmailT;
  locale?: string;
}

export function PatientWelcomeEmail({
  clinicName,
  patientFirstName,
  portalUrl,
  t,
  locale,
}: Props) {
  return (
    <BaseEmail
      clinicName={clinicName}
      previewText={t("welcome.preview", { clinic: clinicName })}
      t={t}
      locale={locale}
    >
      <div style={{ textAlign: "center", marginBottom: 28 }}>
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
          👋
        </div>
        <EmailHeading>{t("welcome.heading", { name: patientFirstName })}</EmailHeading>
        <EmailText muted>
          {t.rich("welcome.subtitle", { clinic: clinicName, b: (c: React.ReactNode) => <strong>{c}</strong> })}
        </EmailText>
      </div>

      <EmailText>{t("welcome.intro")}</EmailText>

      {portalUrl && (
        <>
          <EmailText>
            {t.rich("welcome.portalIntro", { b: (c: React.ReactNode) => <strong>{c}</strong> })}
          </EmailText>
          <div style={{ textAlign: "center" }}>
            <EmailButton href={portalUrl}>
              {t("welcome.portalCta")}
            </EmailButton>
          </div>
          <EmailText muted>{t("welcome.portalNote")}</EmailText>
        </>
      )}

      <EmailDivider />

      <EmailText>{t("welcome.contact")}</EmailText>

      <EmailText muted>{t("welcome.seeYou")}</EmailText>
    </BaseEmail>
  );
}
