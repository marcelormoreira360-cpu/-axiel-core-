import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL ?? "AXIEL Core <onboarding@resend.dev>";

// ── Shared layout ─────────────────────────────────────────────────────────────
function layout(body: string, clinicName = "Sua clínica"): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${clinicName}</title>
</head>
<body style="margin:0;padding:0;background:#F4F3EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3EF;padding:32px 16px;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1px solid rgba(0,0,0,0.07);overflow:hidden;max-width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:#0F1A2E;padding:24px 32px;">
            <p style="margin:0;font-size:16px;font-weight:600;color:#fff;letter-spacing:-0.01em;">${clinicName}</p>
          </td>
        </tr>
        <!-- Body -->
        <tr><td style="padding:32px;">${body}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid rgba(0,0,0,0.06);">
            <p style="margin:0;font-size:11px;color:rgba(0,0,0,0.35);line-height:1.6;">
              Este email foi enviado automaticamente. Por favor não responda a esta mensagem.<br/>
              Seus dados são protegidos conforme a LGPD (Lei 13.709/2018).
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function greenBadge(text: string) {
  return `<span style="display:inline-block;background:#E1F5EE;color:#0F6E56;font-size:12px;font-weight:600;padding:4px 10px;border-radius:20px;">${text}</span>`;
}

function ctaButton(href: string, text: string) {
  return `<a href="${href}" style="display:inline-block;background:#0F1A2E;color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none;margin-top:8px;">${text}</a>`;
}

// ── 1. Confirmação de agendamento (paciente) ──────────────────────────────────
export async function sendAppointmentConfirmation({
  to,
  patientFirstName,
  clinicName,
  sessionTypeName,
  startsAt,
  portalUrl,
}: {
  to: string;
  patientFirstName: string;
  clinicName: string;
  sessionTypeName: string;
  startsAt: string;
  portalUrl?: string;
}) {
  const date = new Date(startsAt);
  const dateStr = date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const body = `
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F1A2E;letter-spacing:-0.02em;">Agendamento confirmado ✅</p>
    <p style="margin:0 0 24px;font-size:14px;color:rgba(0,0,0,0.5);">Olá, ${patientFirstName}! Seu agendamento foi confirmado com sucesso.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3EF;border-radius:12px;padding:20px;margin-bottom:24px;">
      <tr><td>
        <p style="margin:0 0 10px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:rgba(0,0,0,0.35);">Detalhes</p>
        <p style="margin:0 0 6px;font-size:14px;color:#0F1A2E;"><strong>📅</strong> ${dateStr}</p>
        <p style="margin:0 0 6px;font-size:14px;color:#0F1A2E;"><strong>🕐</strong> ${timeStr}</p>
        <p style="margin:0;font-size:14px;color:#0F1A2E;"><strong>🩺</strong> ${sessionTypeName}</p>
      </td></tr>
    </table>
    ${portalUrl ? `<p style="margin:0 0 16px;font-size:14px;color:rgba(0,0,0,0.6);">Acesse seu portal para acompanhar seus agendamentos e enviar mensagens à clínica.</p>${ctaButton(portalUrl, "Acessar meu portal")}` : ""}
  `;

  return resend.emails.send({
    from: FROM,
    to,
    subject: `✅ Agendamento confirmado — ${clinicName}`,
    html: layout(body, clinicName),
  }).catch(() => { /* non-blocking */ });
}

// ── 2. Lembrete D-1 (paciente) ────────────────────────────────────────────────
export async function sendAppointmentReminder({
  to,
  patientFirstName,
  clinicName,
  sessionTypeName,
  startsAt,
  portalUrl,
}: {
  to: string;
  patientFirstName: string;
  clinicName: string;
  sessionTypeName: string;
  startsAt: string;
  portalUrl?: string;
}) {
  const date = new Date(startsAt);
  const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const body = `
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F1A2E;letter-spacing:-0.02em;">Lembrete de amanhã 🗓️</p>
    <p style="margin:0 0 24px;font-size:14px;color:rgba(0,0,0,0.5);">Olá, ${patientFirstName}! Só lembrando que você tem uma sessão amanhã.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3EF;border-radius:12px;padding:20px;margin-bottom:24px;">
      <tr><td>
        <p style="margin:0 0 6px;font-size:14px;color:#0F1A2E;"><strong>🕐</strong> ${timeStr}</p>
        <p style="margin:0;font-size:14px;color:#0F1A2E;"><strong>🩺</strong> ${sessionTypeName}</p>
      </td></tr>
    </table>
    ${portalUrl ? ctaButton(portalUrl, "Ver no portal") : ""}
  `;

  return resend.emails.send({
    from: FROM,
    to,
    subject: `🗓️ Lembrete: sua sessão é amanhã — ${clinicName}`,
    html: layout(body, clinicName),
  }).catch(() => { /* non-blocking */ });
}

// ── 3. Alerta de mensagem nova — para a CLÍNICA ───────────────────────────────
export async function sendClinicMessageAlert({
  to,
  clinicName,
  patientName,
  messagePreview,
  inboxUrl,
}: {
  to: string;
  clinicName: string;
  patientName: string;
  messagePreview: string;
  inboxUrl: string;
}) {
  const preview = messagePreview.length > 200 ? messagePreview.slice(0, 197) + "…" : messagePreview;

  const body = `
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F1A2E;letter-spacing:-0.02em;">Nova mensagem 💬</p>
    <p style="margin:0 0 24px;font-size:14px;color:rgba(0,0,0,0.5);">O paciente <strong>${patientName}</strong> enviou uma mensagem pelo portal.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3EF;border-radius:12px;padding:20px;margin-bottom:24px;">
      <tr><td>
        <p style="margin:0 0 6px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:rgba(0,0,0,0.35);">${patientName}</p>
        <p style="margin:0;font-size:14px;color:#0F1A2E;font-style:italic;">"${preview}"</p>
      </td></tr>
    </table>
    ${ctaButton(inboxUrl, "Responder mensagem")}
  `;

  return resend.emails.send({
    from: FROM,
    to,
    subject: `💬 Nova mensagem de ${patientName} — ${clinicName}`,
    html: layout(body, clinicName),
  }).catch(() => { /* non-blocking */ });
}

// ── 4. Alerta de mensagem nova — para o PACIENTE ──────────────────────────────
export async function sendPatientMessageAlert({
  to,
  patientFirstName,
  clinicName,
  messagePreview,
  portalUrl,
}: {
  to: string;
  patientFirstName: string;
  clinicName: string;
  messagePreview: string;
  portalUrl?: string;
}) {
  const preview = messagePreview.length > 200 ? messagePreview.slice(0, 197) + "…" : messagePreview;

  const body = `
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F1A2E;letter-spacing:-0.02em;">Você tem uma mensagem 💬</p>
    <p style="margin:0 0 24px;font-size:14px;color:rgba(0,0,0,0.5);">Olá, ${patientFirstName}! ${clinicName} enviou uma mensagem para você.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3EF;border-radius:12px;padding:20px;margin-bottom:24px;">
      <tr><td>
        <p style="margin:0 0 6px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:rgba(0,0,0,0.35);">${clinicName}</p>
        <p style="margin:0;font-size:14px;color:#0F1A2E;font-style:italic;">"${preview}"</p>
      </td></tr>
    </table>
    ${portalUrl ? ctaButton(portalUrl, "Ler e responder") : `<p style="margin:16px 0 0;font-size:13px;color:rgba(0,0,0,0.5);">Acesse seu portal usando o link que você recebeu anteriormente para responder.</p>`}
  `;

  return resend.emails.send({
    from: FROM,
    to,
    subject: `💬 Nova mensagem de ${clinicName}`,
    html: layout(body, clinicName),
  }).catch(() => { /* non-blocking */ });
}

// ── 5. Solicitação de NPS pós-sessão (paciente) ───────────────────────────────
export async function sendNpsRequest({
  to,
  patientFirstName,
  clinicName,
  sessionTypeName,
  portalUrl,
}: {
  to: string;
  patientFirstName: string;
  clinicName: string;
  sessionTypeName: string;
  portalUrl: string;
}) {
  const body = `
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F1A2E;letter-spacing:-0.02em;">Como foi sua sessão? ⭐</p>
    <p style="margin:0 0 16px;font-size:14px;color:rgba(0,0,0,0.5);">Olá, ${patientFirstName}! Sua sessão de <strong>${sessionTypeName}</strong> em ${clinicName} foi concluída.</p>
    <p style="margin:0 0 24px;font-size:14px;color:rgba(0,0,0,0.6);">Sua opinião é muito importante para melhorarmos continuamente. Leva menos de 1 minuto!</p>
    ${ctaButton(portalUrl, "Avaliar minha sessão")}
    <p style="margin:16px 0 0;font-size:12px;color:rgba(0,0,0,0.35);">Ou acesse seu portal e clique em "Avaliar sessão".</p>
  `;

  return resend.emails.send({
    from: FROM,
    to,
    subject: `⭐ Como foi sua sessão? — ${clinicName}`,
    html: layout(body, clinicName),
  }).catch(() => { /* non-blocking */ });
}
