import {
  BaseEmail,
  EmailHeading,
  EmailText,
  EmailInfoBox,
  EmailInfoRow,
  EmailDivider,
} from "./base-email";

interface Props {
  clinicName: string;
  patientFirstName: string;
  dateStr: string;
  timeStr: string;
  durationMinutes: number;
  daysUntil: number;    // 1 = tomorrow, 0 = today
  whatsappUrl?: string | null;
}

export function AppointmentReminderEmail({
  clinicName,
  patientFirstName,
  dateStr,
  timeStr,
  durationMinutes,
  daysUntil,
  whatsappUrl,
}: Props) {
  const when = daysUntil === 0 ? "hoje" : daysUntil === 1 ? "amanhã" : `em ${daysUntil} dias`;
  const emoji = daysUntil <= 1 ? "⏰" : "📅";

  return (
    <BaseEmail
      clinicName={clinicName}
      previewText={`Lembrete: você tem uma sessão ${when} às ${timeStr}`}
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
        <EmailHeading>Lembrete de sessão</EmailHeading>
        <EmailText muted>
          Olá, {patientFirstName}! Você tem uma sessão agendada <strong>{when}</strong>.
        </EmailText>
      </div>

      <EmailInfoBox>
        <EmailInfoRow label="📅 Data" value={dateStr} />
        <EmailInfoRow label="🕐 Horário" value={timeStr} />
        <EmailInfoRow label="⏱ Duração" value={`${durationMinutes} minutos`} />
        <EmailInfoRow label="🏥 Clínica" value={clinicName} />
      </EmailInfoBox>

      <EmailDivider />

      <EmailText>
        Se precisar cancelar ou reagendar, avise com antecedência.
        {whatsappUrl && (
          <>
            {" "}
            <a href={whatsappUrl} style={{ color: "#0F6E56", fontWeight: 600 }}>
              Fale pelo WhatsApp →
            </a>
          </>
        )}
      </EmailText>

      <EmailText muted>Até lá! 🌿</EmailText>
    </BaseEmail>
  );
}
