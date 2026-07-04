// Passagem de bastão do bot de WhatsApp (Clara).
//
// A IA fica em silêncio numa conversa quando:
//   1. a equipe pausou manualmente (ai_paused, ou o legado bot_disabled), OU
//   2. um humano respondeu pela UI do Core há menos de 24 horas
//      (last_human_message_at).
//
// Ela volta a responder por devolução manual ("Devolver para a Clara", que
// zera ai_paused e last_human_message_at) ou sozinha após 24h de silêncio
// humano. O gate vale SÓ para a resposta conversacional do bot (webhooks
// inbound); mensagens transacionais (lembretes, confirmações, NPS) não
// passam por ele.

export const HUMAN_HANDOFF_WINDOW_MS = 24 * 60 * 60 * 1000;

export type HandoffState = {
  aiPaused: boolean;
  botDisabled: boolean;
  lastHumanMessageAt: string | null;
};

export type HandoffStatus = "active" | "paused" | "with_team";

/** true se um humano respondeu há menos de 24h (janela de atendimento humano). */
export function isHumanWindowActive(
  lastHumanMessageAt: string | null,
  now: number = Date.now(),
): boolean {
  if (!lastHumanMessageAt) return false;
  const ts = new Date(lastHumanMessageAt).getTime();
  if (Number.isNaN(ts)) return false;
  return now - ts < HUMAN_HANDOFF_WINDOW_MS;
}

/** true se o bot conversacional NÃO deve responder nesta conversa. */
export function shouldSilenceAi(state: HandoffState, now: number = Date.now()): boolean {
  return state.aiPaused || state.botDisabled || isHumanWindowActive(state.lastHumanMessageAt, now);
}

/** Estado exibido na UI: IA ativa / IA pausada / Com a equipe (24h). */
export function handoffStatus(state: HandoffState, now: number = Date.now()): HandoffStatus {
  if (state.aiPaused || state.botDisabled) return "paused";
  if (isHumanWindowActive(state.lastHumanMessageAt, now)) return "with_team";
  return "active";
}
