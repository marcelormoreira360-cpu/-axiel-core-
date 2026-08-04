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

// ─── DESCADASTRO / "pare de me mandar mensagem" ──────────────────────────────
// Diferente do opt-out (que quer FALAR com humano), aqui o lead quer PARAR de
// receber mensagens (respostas hostis a anúncio: "stop", "don't text me",
// "unsubscribe"). O bot confirma o descadastro no idioma do lead e se cala.
//
// Cuidado clínico: "parar"/"stop"/"cancelar" aparecem em conversa legítima
// ("quero PARAR de sentir dor", "quero CANCELAR meu horário"). Por isso a
// detecção é em DOIS níveis:
//   1) frases inequívocas multi-palavra — valem mesmo dentro de um texto maior;
//   2) palavras isoladas ambíguas — só valem se forem a MENSAGEM INTEIRA (curta).

// Frases fortes (multi-palavra): opt-out mesmo no meio de outra frase.
const UNSUB_STRONG = [
  "unsubscribe", "stop texting", "stop messaging", "stop sending", "stop contacting",
  "don't text me", "dont text me", "do not text me", "don't message me", "dont message me",
  "don't contact me", "dont contact me", "do not contact me", "stop texting me",
  "remove me", "take me off", "leave me alone", "not interested", "no longer interested",
  "quit messaging", "stop the messages", "stop these messages",
  "pare de me mandar", "para de me mandar", "parem de me mandar", "nao me mande", "nao me mandem",
  "nao quero receber", "nao quero mais receber", "me tira da lista", "me tire da lista",
  "me remova", "descadastr", "sair da lista",
];

// Palavras/curtas ambíguas: SÓ contam se forem a mensagem inteira (curta e
// isolada). NÃO inclui "cancel"/"cancelar" — num bot clínico um "cancelar" solto
// normalmente é cancelamento de HORÁRIO, não descadastro.
const UNSUB_STANDALONE = [
  "stop", "unsubscribe", "remove",
  "para", "pare", "parar", "sair", "chega",
];

/**
 * true se a mensagem é um pedido de DESCADASTRO ("pare de me mandar mensagem").
 * Nível 1 (frases fortes) casa em qualquer posição; nível 2 (palavras isoladas)
 * só casa quando a mensagem é essencialmente só aquela palavra.
 */
export function isUnsubscribeRequest(text: string): boolean {
  const t = (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9'\s]/g, " ") // remove pontuação/emoji, preserva apóstrofo
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return false;
  if (UNSUB_STRONG.some((p) => t.includes(p))) return true;
  // Nível 2: mensagem inteira é a palavra de opt-out (tolera "please"/"por favor").
  const stripped = t
    .replace(/\b(please|por favor|pf|now|agora|it|me)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return UNSUB_STANDALONE.includes(stripped);
}
