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
  startsAt: string | null
): string {
  const time = startsAt
    ? new Date(startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "horário agendado";
  const date = startsAt
    ? new Date(startsAt).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
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
  startsAt: string | null
): string {
  const first = fullName.split(" ")[0];

  if (tag === "d-1") {
    const time = startsAt
      ? new Date(startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : "horário agendado";
    return `Olá, ${first}! 👋\n\nLembrete: sua sessão é *amanhã* às ${time}. 📅\n\nAté lá!`;
  }

  if (tag === "nps") {
    return (
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
    return (
      `Olá, ${first}! 😊\n\n` +
      `Já se passaram alguns dias desde a sua sessão. Como está se sentindo?\n\n` +
      `Se tiver dúvidas ou quiser agendar o próximo atendimento, estou aqui. 🌿`
    );
  }

  // d+30
  return (
    `Olá, ${first}! 🌟\n\n` +
    `Faz 30 dias desde a sua última sessão — sentiu evolução? 💪\n\n` +
    `Que tal agendar o próximo atendimento para continuar o seu progresso?`
  );
}
