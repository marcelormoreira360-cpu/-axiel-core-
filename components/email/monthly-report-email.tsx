import {
  BaseEmail,
  EmailHeading,
  EmailText,
  EmailDivider,
  EmailInfoBox,
  EmailButton,
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
}

const ROWS: Array<{ icon: string; label: string; key: keyof MonthlyReportEmailProps["metrics"] }> = [
  { icon: "💰", label: "Receita no mês",                    key: "revenue" },
  { icon: "📅", label: "Sessões realizadas",                 key: "sessions" },
  { icon: "👤", label: "Novos pacientes no mês",             key: "newPatients" },
  { icon: "📦", label: "Pacotes ativos",                     key: "activePackages" },
  { icon: "💤", label: "Pacientes sem sessão há 30+ dias",   key: "inactivePatients" },
];

export function MonthlyReportEmail({
  clinicName,
  monthName,
  appUrl,
  metrics,
}: MonthlyReportEmailProps) {
  return (
    <BaseEmail
      clinicName={clinicName}
      previewText={`Relatório de ${monthName} — ${clinicName}`}
    >
      <EmailHeading>Relatório de {monthName}</EmailHeading>
      <EmailText>Confira os números de {clinicName} em {monthName}.</EmailText>

      <EmailDivider />

      {/* Metrics table */}
      <table width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse", borderRadius: 10, overflow: "hidden", border: "1px solid #E8E6E0", marginBottom: 8 }}>
        <tbody>
          {ROWS.map(({ icon, label, key }, i) => (
            <tr key={key} style={{ backgroundColor: i % 2 === 0 ? "#FAFAF8" : "#FFFFFF" }}>
              <td style={{ padding: "10px 16px", fontSize: 13, color: "#374151", borderBottom: "1px solid #F0EFEB" }}>
                {icon} {label}
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
            <strong>💡 Dica de reengajamento:</strong> Você tem{" "}
            <strong>{metrics.inactivePatients} paciente{metrics.inactivePatients !== 1 ? "s" : ""}</strong> sem sessão há mais
            de 30 dias. Uma mensagem personalizada pode ser a oportunidade de retomada do tratamento.
          </p>
        </EmailInfoBox>
      )}

      <EmailButton href={`${appUrl}/results`}>Ver análise completa →</EmailButton>

      <EmailDivider />

      <EmailText muted>
        Este relatório é enviado automaticamente no início de cada mês pelo AXIEL Core.
      </EmailText>
    </BaseEmail>
  );
}
