import {
  BaseEmail,
  EmailHeading,
  EmailText,
  EmailButton,
  EmailDivider,
} from "./base-email";

interface Props {
  clinicName: string;
  patientFirstName: string;
  portalUrl?: string | null;
}

export function PatientWelcomeEmail({
  clinicName,
  patientFirstName,
  portalUrl,
}: Props) {
  return (
    <BaseEmail
      clinicName={clinicName}
      previewText={`Bem-vindo(a) à ${clinicName}! Seu cadastro foi criado.`}
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
        <EmailHeading>Bem-vindo(a), {patientFirstName}!</EmailHeading>
        <EmailText muted>
          Seu cadastro na <strong>{clinicName}</strong> foi criado com sucesso.
        </EmailText>
      </div>

      <EmailText>
        Estamos felizes em ter você como paciente. Aqui você poderá acompanhar sua evolução,
        histórico de sessões e muito mais.
      </EmailText>

      {portalUrl && (
        <>
          <EmailText>
            Acesse seu <strong>portal do paciente</strong> para ver seus agendamentos,
            progresso e informações personalizadas:
          </EmailText>
          <div style={{ textAlign: "center" }}>
            <EmailButton href={portalUrl}>
              Acessar meu portal →
            </EmailButton>
          </div>
          <EmailText muted>
            Este link é exclusivo para você. Não compartilhe com outras pessoas.
          </EmailText>
        </>
      )}

      <EmailDivider />

      <EmailText>
        Em caso de dúvidas ou para agendar sua primeira sessão, entre em contato com a clínica.
      </EmailText>

      <EmailText muted>Até breve! 🌿</EmailText>
    </BaseEmail>
  );
}
