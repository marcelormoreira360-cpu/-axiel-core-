// E-mail de RESULTADO do MSQ (formulário público / feira).
//
// Enviado ao respondente logo após ele preencher o formulário público em
// /f/[token]. Reaproveita a copy JÁ APROVADA da tela de resultado
// (namespace i18n `publicForm.result.*`) — NÃO cria copy clínica nova — e o
// contato oficial da IFWC (lib/contact, fonte única com a tela).
//
// Prudente por construção: educativo, sem diagnóstico. Idioma = locale da
// submissão (EN ou pt-BR). Falha aqui NÃO pode derrubar o submit — quem chama
// envolve em try/catch (o `sendSimpleEmail` lança em erro de API do Resend).

import { getServerT } from "@/lib/email-i18n";
import { isLocale, DEFAULT_LOCALE, type Locale } from "@/i18n/locales";
import { sendSimpleEmail } from "@/services/email-service";
import {
  CONTACT_CLINIC_NAME,
  CONTACT_PHONE_DIGITS,
  CONTACT_PHONE_DISPLAY,
  CONTACT_SITE_URL,
  CONTACT_SITE_LABEL,
} from "@/lib/contact";
import type { ScoreBand } from "@/lib/types";

type SafetyFlags = { showA: boolean; showB: boolean; showC: boolean };

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function firstNameOf(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  return first || fullName.trim();
}

/**
 * Monta e envia o e-mail de resultado. `band` já vem calculada pelo backend
 * (mesma `gradeTotalByMode` que a tela usa) — este serviço só apresenta.
 */
export async function sendMsqResultEmail(input: {
  to: string;
  fullName: string;
  totalScore: number;
  maxScore: number;
  scorePercentage: number;
  band: ScoreBand | null;
  safetyFlags: SafetyFlags | null;
  locale: string | null | undefined;
}): Promise<void> {
  const loc: Locale = isLocale(input.locale) ? input.locale : DEFAULT_LOCALE;
  const t = await getServerT(loc, "publicForm");

  const firstName = esc(firstNameOf(input.fullName));
  const band = input.band;
  const bandColor = band?.color || "#0F6E56";
  const flags = input.safetyFlags;

  const scoreLine = esc(
    t("result.scoreLine", {
      score: input.totalScore,
      max: input.maxScore,
      percent: input.scorePercentage,
      band: band?.label ?? "—",
    }),
  );

  // Barra de progresso (largura = percentual, cor da faixa).
  const pct = Math.max(0, Math.min(100, input.scorePercentage));

  const bandBlock =
    band?.description
      ? `
      <tr><td style="padding:16px 0 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:${bandColor}14;border:1px solid ${bandColor}33;border-radius:12px;">
          <tr><td style="padding:14px 16px;">
            <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:${bandColor};">${esc(band.label)}</p>
            <p style="margin:0;font-size:13px;color:#4A4A46;line-height:1.6;">${esc(band.description)}</p>
          </td></tr>
        </table>
      </td></tr>`
      : "";

  function note(text: string, bg: string, border: string, color: string) {
    return `
      <tr><td style="padding:12px 0 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border:1px solid ${border};border-radius:12px;">
          <tr><td style="padding:12px 16px;">
            <p style="margin:0;font-size:13px;color:${color};line-height:1.6;">${esc(text)}</p>
          </td></tr>
        </table>
      </td></tr>`;
  }

  const notesBlock =
    (flags?.showA ? note(t("result.noteA"), "#FDF6EC", "#E9D8B0", "#7A5B12") : "") +
    (flags?.showB ? note(t("result.noteB"), "#FDF6EC", "#E9D8B0", "#7A5B12") : "") +
    (flags?.showC ? note(t("result.noteC"), "#EAF4FB", "#BBD9EC", "#1E4C6B") : "");

  const html = `<!DOCTYPE html>
<html lang="${loc}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>IFWC</title>
</head>
<body style="margin:0;padding:0;background:#FAFAF8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(t("resultEmail.intro"))}</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF8;padding:24px 12px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#fff;border-radius:16px;border:1px solid rgba(0,0,0,0.07);overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:#0F1A2E;padding:20px 24px;">
          <p style="margin:0;font-size:15px;font-weight:600;color:#fff;letter-spacing:-0.01em;">IFWC</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:28px 24px;">
          <p style="margin:0 0 4px;font-size:20px;font-weight:600;color:#0F1A2E;">${esc(t("result.heading"))}</p>
          <p style="margin:0 0 4px;font-size:14px;color:#4A4A46;">${esc(t("resultEmail.greeting", { name: firstName }))}</p>
          <p style="margin:0 0 18px;font-size:14px;color:#4A4A46;line-height:1.6;">${esc(t("resultEmail.intro"))}</p>

          <!-- Score -->
          <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#0F1A2E;">${scoreLine}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3EF;border-radius:999px;height:6px;">
            <tr><td style="padding:0;">
              <table width="${pct}%" cellpadding="0" cellspacing="0" style="min-width:2px;"><tr>
                <td style="background:${bandColor};height:6px;border-radius:999px;font-size:0;line-height:0;">&nbsp;</td>
              </tr></table>
            </td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0">
            ${bandBlock}
          </table>

          <!-- What this means -->
          <p style="margin:20px 0 4px;font-size:14px;font-weight:600;color:#0F1A2E;">${esc(t("result.whatThisMeansTitle"))}</p>
          <p style="margin:0;font-size:13px;color:#4A4A46;line-height:1.7;">${esc(t("result.whatThisMeansBody"))}</p>

          <!-- Conditional safety notes -->
          <table width="100%" cellpadding="0" cellspacing="0">
            ${notesBlock}
          </table>

          <!-- CTA de contato (mesma copy da tela) -->
          <p style="margin:22px 0 2px;font-size:14px;font-weight:600;color:#0F1A2E;">${esc(t("result.ctaTitle"))}</p>
          <p style="margin:0 0 10px;font-size:13px;color:#4A4A46;line-height:1.7;">${esc(t("result.ctaBody"))}</p>

          <!-- Sugestão de agendamento (convidativa, sem prometer resultado) -->
          <p style="margin:0 0 16px;font-size:13px;color:#4A4A46;line-height:1.7;">${esc(t("resultEmail.scheduleLine"))}</p>

          <!-- Bloco de contato da clínica (nome completo + telefone + site) -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3EF;border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0 0 2px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#A09E98;">${esc(t("resultEmail.clinicBlockTitle"))}</p>
              <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#0F1A2E;">${esc(CONTACT_CLINIC_NAME)}</p>
              <p style="margin:0 0 4px;font-size:13px;color:#4A4A46;">
                ${esc(t("resultEmail.clinicPhoneLabel"))}
                <a href="tel:+1${CONTACT_PHONE_DIGITS}" style="color:#0F6E56;font-weight:600;text-decoration:underline;">${esc(CONTACT_PHONE_DISPLAY)}</a>
              </p>
              <p style="margin:0;font-size:13px;color:#4A4A46;">
                ${esc(t("resultEmail.clinicSiteLabel"))}
                <a href="${CONTACT_SITE_URL}" style="color:#0F6E56;font-weight:600;text-decoration:underline;">${esc(CONTACT_SITE_LABEL)}</a>
              </p>
            </td></tr>
          </table>
        </td></tr>
        <!-- Footer (disclaimer + 988 + 18+) -->
        <tr><td style="padding:18px 24px;border-top:1px solid rgba(0,0,0,0.06);">
          <p style="margin:0 0 6px;font-size:11px;color:#A09E98;line-height:1.6;">${esc(t("result.footerDisclaimer"))}</p>
          <p style="margin:0 0 6px;font-size:11px;color:#A09E98;line-height:1.6;">${esc(t("result.footer988"))}</p>
          <p style="margin:0;font-size:11px;color:#A09E98;line-height:1.6;">${esc(t("result.footerAge"))}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendSimpleEmail({
    to: input.to,
    subject: t("resultEmail.subject"),
    html,
  });
}
