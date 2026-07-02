/**
 * Pure helper functions for WhatsApp automation messages.
 * Extracted from services/automation-service.ts so they can be unit-tested
 * without importing Supabase / Resend dependencies.
 */

// ─── Template interpolation ───────────────────────────────────────────────────

/**
 * Replaces {{nome}}, {{horario}}, {{data}} in a custom template string.
 */
export function interpolateTemplate(
  template: string,
  firstName: string,
  startsAt: string | null,
  timeZone?: string
): string {
  const time = startsAt
    ? new Date(startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone })
    : "horário agendado";
  const date = startsAt
    ? new Date(startsAt).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone })
    : "data agendada";
  return template
    .replace(/{{nome}}/g, firstName)
    .replace(/{{horario}}/g, time)
    .replace(/{{data}}/g, date);
}

// ─── Default automation messages ─────────────────────────────────────────────

/**
 * Returns the default WhatsApp message for each automation tag.
 * Tags: "d-1" | "nps" | "d+3" | "d+30"
 */
export function buildMessage(
  tag: string,
  fullName: string,
  startsAt: string | null,
  timeZone?: string,
  locale: string = "pt-BR"
): string {
  const first = fullName.split(" ")[0];
  const en = locale.startsWith("en");

  if (tag === "d-1") {
    const time = startsAt
      ? new Date(startsAt).toLocaleTimeString(en ? "en-US" : "pt-BR", { hour: "2-digit", minute: "2-digit", timeZone })
      : en ? "the scheduled time" : "horário agendado";
    return en
      ? `Hi, ${first}! 👋\n\nReminder: your session is *tomorrow* at ${time}. 📅\n\nSee you there!`
      : `Olá, ${first}! 👋\n\nLembrete: sua sessão é *amanhã* às ${time}. 📅\n\nAté lá!`;
  }

  if (tag === "nps") {
    return en
      ? (
        `Hi, ${first}! 🌿\n\n` +
        `How was your session yesterday?\n\n` +
        `Reply with a number:\n` +
        `1 — Needs improvement\n` +
        `2 — Fair\n` +
        `3 — Good\n` +
        `4 — Very good\n` +
        `5 — Excellent ⭐\n\n` +
        `Just type the number and send.`
      )
      : (
        `Olá, ${first}! 🌿\n\n` +
        `Como foi sua sessão de ontem?\n\n` +
        `Responda com um número:\n` +
        `1 — Precisa melhorar\n` +
        `2 — Razoável\n` +
        `3 — Boa\n` +
        `4 — Muito boa\n` +
        `5 — Excelente ⭐\n\n` +
        `Basta digitar o número e enviar.`
      );
  }

  if (tag === "d+3") {
    return en
      ? (
        `Hi, ${first}! 😊\n\n` +
        `It has been a few days since your session. How are you feeling?\n\n` +
        `If you have questions or want to book your next visit, I am here. 🌿`
      )
      : (
        `Olá, ${first}! 😊\n\n` +
        `Já se passaram alguns dias desde a sua sessão. Como está se sentindo?\n\n` +
        `Se tiver dúvidas ou quiser agendar o próximo atendimento, estou aqui. 🌿`
      );
  }

  // d+30
  return en
    ? (
      `Hi, ${first}! 🌟\n\n` +
      `It has been 30 days since your last session — feeling the progress? 💪\n\n` +
      `How about booking your next visit to keep it going?`
    )
    : (
      `Olá, ${first}! 🌟\n\n` +
      `Faz 30 dias desde a sua última sessão — sentiu evolução? 💪\n\n` +
      `Que tal agendar o próximo atendimento para continuar o seu progresso?`
    );
}
