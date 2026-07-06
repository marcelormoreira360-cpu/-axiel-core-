// Opt-out / escalonamento humano ("falar com atendente").
//
// Extraído dos webhooks Meta (Facebook/Instagram), que mantinham cada um a sua
// cópia idêntica. Agora os canais (Messenger, Instagram, SMS) compartilham a
// mesma detecção. Exigência do App Review da Meta: o usuário precisa conseguir
// sair da automação e falar com uma pessoa.
//
// Detecção por FRASE (sem "parar"/"stop" soltos) para evitar falso positivo em
// conversa clínica (ex.: "quero parar de sentir dor").

export const OPT_OUT_PATTERNS = [
  "falar com atendente", "falar com um atendente", "falar com humano", "falar com um humano",
  "falar com uma pessoa", "falar com alguem", "falar com a equipe", "falar com a recepcao",
  "atendente", "atendimento humano", "quero um humano", "pessoa de verdade", "ser humano",
  "talk to a human", "talk to a person", "talk to an agent", "speak to a human",
  "speak to a person", "speak to an agent", "speak to someone", "real person",
  "human agent", "live agent",
];

/** true se a mensagem é um pedido claro de atendimento humano (PT/EN, ignora acentos). */
export function isOptOutRequest(text: string): boolean {
  const t = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return OPT_OUT_PATTERNS.some((p) => t.includes(p));
}
