import { Resend } from "resend";
import { getServerT } from "@/lib/email-i18n";
import { isLocale, DEFAULT_LOCALE } from "@/i18n/locales";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL ?? "AXIEL Core <onboarding@resend.dev>";

// Envio simples e genérico (assunto + HTML), para fluxos avulsos.
// O SDK do Resend NÃO lança exceção em erro de API — retorna { data, error }.
// Sem checar `error`, um envio rejeitado seria reportado como "enviado".
export async function sendSimpleEmail(input: { to: string; subject: string; html: string }): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY não configurada no ambiente.");
  }
  const { error } = await resend.emails.send({ from: FROM, to: input.to, subject: input.subject, html: input.html });
  if (error) {
    throw new Error(`Resend: ${error.message ?? "envio rejeitado"}${FROM.includes("resend.dev") ? " (remetente padrão resend.dev só entrega no e-mail dono da conta — verifique um domínio em RESEND_FROM_EMAIL)" : ""}`);
  }
}

type EmailT = Awaited<ReturnType<typeof getServerT>>;

function htmlLang(locale: string | null | undefined) {
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}

// ── Shared layout ─────────────────────────────────────────────────────────────
function layout(body: string, clinicName: string, t: EmailT, locale: string): string {
  return `<!DOCTYPE html>
<html lang="${htmlLang(locale)}">
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
              ${t("footerAuto")}<br/>
              ${t("footerLgpd")}
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
  locale,
}: {
  to: string;
  patientFirstName: string;
  clinicName: string;
  sessionTypeName: string;
  startsAt: string;
  portalUrl?: string;
  locale?: string;
}) {
  const loc = htmlLang(locale);
  const t = await getServerT(loc, "emails");
  const date = new Date(startsAt);
  const dateStr = date.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const timeStr = date.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });

  const body = `
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F1A2E;letter-spacing:-0.02em;">${t("confirm.title")}</p>
    <p style="margin:0 0 24px;font-size:14px;color:rgba(0,0,0,0.5);">${t("confirm.greeting", { name: patientFirstName })}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3EF;border-radius:12px;padding:20px;margin-bottom:24px;">
      <tr><td>
        <p style="margin:0 0 10px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:rgba(0,0,0,0.35);">${t("confirm.details")}</p>
        <p style="margin:0 0 6px;font-size:14px;color:#0F1A2E;"><strong>📅</strong> ${dateStr}</p>
        <p style="margin:0 0 6px;font-size:14px;color:#0F1A2E;"><strong>🕐</strong> ${timeStr}</p>
        <p style="margin:0;font-size:14px;color:#0F1A2E;"><strong>🩺</strong> ${sessionTypeName}</p>
      </td></tr>
    </table>
    ${portalUrl ? `<p style="margin:0 0 16px;font-size:14px;color:rgba(0,0,0,0.6);">${t("confirm.portalText")}</p>${ctaButton(portalUrl, t("confirm.portalCta"))}` : ""}
  `;

  return resend.emails.send({
    from: FROM,
    to,
    subject: t("confirm.subject", { clinic: clinicName }),
    html: layout(body, clinicName, t, loc),
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
  locale,
}: {
  to: string;
  patientFirstName: string;
  clinicName: string;
  sessionTypeName: string;
  startsAt: string;
  portalUrl?: string;
  locale?: string;
}) {
  const loc = htmlLang(locale);
  const t = await getServerT(loc, "emails");
  const date = new Date(startsAt);
  const timeStr = date.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });

  const body = `
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F1A2E;letter-spacing:-0.02em;">${t("reminder.title")}</p>
    <p style="margin:0 0 24px;font-size:14px;color:rgba(0,0,0,0.5);">${t("reminder.greeting", { name: patientFirstName })}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3EF;border-radius:12px;padding:20px;margin-bottom:24px;">
      <tr><td>
        <p style="margin:0 0 6px;font-size:14px;color:#0F1A2E;"><strong>🕐</strong> ${timeStr}</p>
        <p style="margin:0;font-size:14px;color:#0F1A2E;"><strong>🩺</strong> ${sessionTypeName}</p>
      </td></tr>
    </table>
    ${portalUrl ? ctaButton(portalUrl, t("reminder.cta")) : ""}
  `;

  return resend.emails.send({
    from: FROM,
    to,
    subject: t("reminder.subject", { clinic: clinicName }),
    html: layout(body, clinicName, t, loc),
  }).catch(() => { /* non-blocking */ });
}

// ── 3. Alerta de mensagem nova — para a CLÍNICA ───────────────────────────────
export async function sendClinicMessageAlert({
  to,
  clinicName,
  patientName,
  messagePreview,
  inboxUrl,
  locale,
}: {
  to: string;
  clinicName: string;
  patientName: string;
  messagePreview: string;
  inboxUrl: string;
  locale?: string;
}) {
  const loc = htmlLang(locale);
  const t = await getServerT(loc, "emails");
  const preview = messagePreview.length > 200 ? messagePreview.slice(0, 197) + "…" : messagePreview;

  const body = `
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F1A2E;letter-spacing:-0.02em;">${t("clinicMsg.title")}</p>
    <p style="margin:0 0 24px;font-size:14px;color:rgba(0,0,0,0.5);">${t.markup("clinicMsg.body", { name: patientName, b: (c) => `<strong>${c}</strong>` })}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3EF;border-radius:12px;padding:20px;margin-bottom:24px;">
      <tr><td>
        <p style="margin:0 0 6px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:rgba(0,0,0,0.35);">${patientName}</p>
        <p style="margin:0;font-size:14px;color:#0F1A2E;font-style:italic;">"${preview}"</p>
      </td></tr>
    </table>
    ${ctaButton(inboxUrl, t("clinicMsg.cta"))}
  `;

  return resend.emails.send({
    from: FROM,
    to,
    subject: t("clinicMsg.subject", { name: patientName, clinic: clinicName }),
    html: layout(body, clinicName, t, loc),
  }).catch(() => { /* non-blocking */ });
}

// ── 4. Alerta de mensagem nova — para o PACIENTE ──────────────────────────────
export async function sendPatientMessageAlert({
  to,
  patientFirstName,
  clinicName,
  messagePreview,
  portalUrl,
  locale,
}: {
  to: string;
  patientFirstName: string;
  clinicName: string;
  messagePreview: string;
  portalUrl?: string;
  locale?: string;
}) {
  const loc = htmlLang(locale);
  const t = await getServerT(loc, "emails");
  const preview = messagePreview.length > 200 ? messagePreview.slice(0, 197) + "…" : messagePreview;

  const body = `
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F1A2E;letter-spacing:-0.02em;">${t("patientMsg.title")}</p>
    <p style="margin:0 0 24px;font-size:14px;color:rgba(0,0,0,0.5);">${t("patientMsg.body", { name: patientFirstName, clinic: clinicName })}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3EF;border-radius:12px;padding:20px;margin-bottom:24px;">
      <tr><td>
        <p style="margin:0 0 6px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:rgba(0,0,0,0.35);">${clinicName}</p>
        <p style="margin:0;font-size:14px;color:#0F1A2E;font-style:italic;">"${preview}"</p>
      </td></tr>
    </table>
    ${portalUrl ? ctaButton(portalUrl, t("patientMsg.cta")) : `<p style="margin:16px 0 0;font-size:13px;color:rgba(0,0,0,0.5);">${t("patientMsg.noPortalNote")}</p>`}
  `;

  return resend.emails.send({
    from: FROM,
    to,
    subject: t("patientMsg.subject", { clinic: clinicName }),
    html: layout(body, clinicName, t, loc),
  }).catch(() => { /* non-blocking */ });
}

// ── 5. Solicitação de NPS pós-sessão (paciente) ───────────────────────────────
export async function sendNpsRequest({
  to,
  patientFirstName,
  clinicName,
  sessionTypeName,
  portalUrl,
  locale,
}: {
  to: string;
  patientFirstName: string;
  clinicName: string;
  sessionTypeName: string;
  portalUrl: string;
  locale?: string;
}) {
  const loc = htmlLang(locale);
  const t = await getServerT(loc, "emails");
  const body = `
    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F1A2E;letter-spacing:-0.02em;">${t("nps.title")}</p>
    <p style="margin:0 0 16px;font-size:14px;color:rgba(0,0,0,0.5);">${t.markup("nps.greeting", { name: patientFirstName, sessionType: sessionTypeName, clinic: clinicName, b: (c) => `<strong>${c}</strong>` })}</p>
    <p style="margin:0 0 24px;font-size:14px;color:rgba(0,0,0,0.6);">${t("nps.sub")}</p>
    ${ctaButton(portalUrl, t("nps.cta"))}
    <p style="margin:16px 0 0;font-size:12px;color:rgba(0,0,0,0.35);">${t("nps.orNote")}</p>
  `;

  return resend.emails.send({
    from: FROM,
    to,
    subject: t("nps.subject", { clinic: clinicName }),
    html: layout(body, clinicName, t, loc),
  }).catch(() => { /* non-blocking */ });
}
