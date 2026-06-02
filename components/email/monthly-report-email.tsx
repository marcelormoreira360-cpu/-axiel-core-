import {
  BaseEmail,
  EmailHeading,
  EmailText,
  EmailDivider,
  EmailInfoBox,
  EmailButton,
  type EmailT,
} from "@/components/email/base-email";

export interface MonthlyReportEmailProps {
  clinicName: string;
  monthName: string;
  appUrl: string;
  metrics: {
    revenue: string;
    sessions: number;
    newPatients: number;
    activePackages: number;
    inactivePatients: number;
  };
  t: EmailT;
  locale?: string;
}

const ROWS: Array<{ icon: string; labelKey: string; key: keyof MonthlyReportEmailProps["metrics"] }> = [
  { icon: "💰", labelKey: "monthly.rowRevenue",  key: "revenue" },
  { icon: "📅", labelKey: "monthly.rowSessions", key: "sessions" },
  { icon: "👤", labelKey: "monthly.rowNew",      key: "newPatients" },
  { icon: "📦", labelKey: "monthly.rowPackages", key: "activePackages" },
  { icon: "💤", labelKey: "monthly.rowInactive", key: "inactivePatients" },
];

export function MonthlyReportEmail({
  clinicName,
  monthName,
  appUrl,
  metrics,
  t,
  locale,
}: MonthlyReportEmailProps) {
  return (
    <BaseEmail
      clinicName={clinicName}
      previewText={t("monthly.preview", { month: monthName, clinic: clinicName })}
      t={t}
      locale={locale}
    >
      <EmailHeading>{t("monthly.heading", { month: monthName })}</EmailHeading>
      <EmailText>{t("monthly.intro", { clinic: clinicName, month: monthName })}</EmailText>

      <EmailDivider />

      {/* Metrics table */}
      <table width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse", borderRadius: 10, overflow: "hidden", border: "1px solid #E8E6E0", marginBottom: 8 }}>
        <tbody>
          {ROWS.map(({ icon, labelKey, key }, i) => (
            <tr key={key} style={{ backgroundColor: i % 2 === 0 ? "#FAFAF8" : "#FFFFFF" }}>
              <td style={{ padding: "10px 16px", fontSize: 13, color: "#374151", borderBottom: "1px solid #F0EFEB" }}>
                {t(labelKey)}
              </td>
              <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#0F1A2E", textAlign: "right", borderBottom: "1px solid #F0EFEB", whiteSpace: "nowrap" }}>
                {String(metrics[key])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Inactive patients alert */}
      {metrics.inactivePatients > 0 && (
        <EmailInfoBox>
          <p style={{ margin: 0, fontSize: 13, color: "#0F6E56", lineHeight: 1.6 }}>
            {t.rich("monthly.tipReengage", { count: metrics.inactivePatients, b: (c: React.ReactNode) => <strong>{c}</strong> })}
          </p>
        </EmailInfoBox>
      )}

      <EmailButton href={`${appUrl}/results`}>{t("monthly.cta")}</EmailButton>

      <EmailDivider />

      <EmailText muted>{t("monthly.footerAuto")}</EmailText>
    </BaseEmail>
  );
}
