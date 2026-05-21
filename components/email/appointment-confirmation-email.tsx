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
  dateStr: string;   // e.g. "segunda-feira, 12 de maio"
  timeStr: string;   // e.g. "10:00"
  durationMinutes: number;
  whatsappUrl?: string | null;
}

export function AppointmentConfirmationEmail({
  clinicName,
  patientFirstName,
  dateStr,
  timeStr,
  durationMinutes,
  whatsappUrl,
}: Props) {
  return (
    <BaseEmail
      clinicName={clinicName}
      previewText={`Sua sessão está confirmada — ${dateStr} às ${timeStr}`}
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
        <EmailHeading>Sessão confirmada!</EmailHeading>
        <EmailText muted>
          Olá, {patientFirstName}. Sua sessão está agendada e confirmada.
        </EmailText>
      </div>

      {/* Session details */}
      <EmailInfoBox>
        <EmailInfoRow label="📅 Data" value={dateStr} />
        <EmailInfoRow label="🕐 Horário" value={timeStr} />
        <EmailInfoRow label="⏱ Duração" value={`${durationMinutes} minutos`} />
        <EmailInfoRow label="🏥 Clínica" value={clinicName} />
      </EmailInfoBox>

      <EmailDivider />

      <EmailText>
        Precisa reagendar ou tem alguma dúvida?
        {whatsappUrl ? (
          <>
            {" "}Entre em contato pelo{" "}
            <a href={whatsappUrl} style={{ color: "#0F6E56", fontWeight: 600 }}>
              WhatsApp da clínica
            </a>
            .
          </>
        ) : (
          " Entre em contato diretamente com a clínica."
        )}
      </EmailText>

      <EmailText muted>Até lá! 🌿</EmailText>
    </BaseEmail>
  );
}
