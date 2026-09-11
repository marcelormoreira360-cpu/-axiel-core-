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
// Incluem pedidos hostis a anúncio ("block me", "stop harassing"), que NUNCA são
// mensagens clínicas legítimas — logo entram como frase forte, sem risco de falso
// positivo em conversa de paciente.
const UNSUB_STRONG = [
  "unsubscribe", "stop texting", "stop messaging", "stop sending", "stop contacting",
  "don't text me", "dont text me", "do not text me", "don't message me", "dont message me",
  "don't contact me", "dont contact me", "do not contact me", "stop texting me",
  "remove me", "take me off", "leave me alone", "not interested", "no longer interested",
  "quit messaging", "quit texting", "stop reaching out", "stop the messages", "stop these messages",
  // Bloqueio / assédio (respostas hostis a anúncio — nunca clínicas). "harassing"
  // SÓ com "stop" na frente (comando de parar): "harassment"/"harassing me" soltos
  // colidiriam com paciente de saúde mental descrevendo assédio ("dealing with
  // harassment at work", "my boss keeps harassing me").
  "block me", "block this", "please block", "just block",
  "stop harassing", "stop harrassing", "stop bothering",
  "stop spamming", "stop the spam", "stop spam",
  "pare de me mandar", "para de me mandar", "parem de me mandar", "nao me mande", "nao me mandem",
  "nao quero receber", "nao quero mais receber", "me tira da lista", "me tire da lista",
  "me remova", "descadastr", "sair da lista",
  // Bloqueio / "me deixa em paz" em português:
  "me bloqueia", "me bloqueie", "me deixa em paz",
  "deixe me em paz", "deixa eu em paz", "para de me perturbar", "pare de me perturbar",
  "para de me incomodar", "pare de me incomodar", "chega de mensagem",
];

// Palavras/curtas ambíguas: SÓ contam se forem a mensagem inteira (curta e
// isolada). NÃO inclui "cancel"/"cancelar" — num bot clínico um "cancelar" solto
// normalmente é cancelamento de HORÁRIO, não descadastro.
const UNSUB_STANDALONE = [
  "stop", "unsubscribe", "remove", "block", "blocked", "spam",
  "para", "pare", "parar", "sair", "chega", "bloquear", "bloqueia", "bloqueie",
];

// Frases curtas de MÚLTIPLAS palavras que só valem como MENSAGEM INTEIRA. São
// idiomas hostis ("go away", "vai embora") cujo sentido literal ("sumir/ir
// embora") colide com queixa clínica — "I want the pain to go away", "essa dor
// não vai embora", "não me esquece". Como substring disparariam falso positivo e
// calariam o bot num lead real; como mensagem inteira são inequívocos.
const UNSUB_STANDALONE_PHRASES = [
  "go away", "get lost", "vai embora", "me esquece",
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
  if (UNSUB_STANDALONE.includes(stripped)) return true;
  // Frases hostis de 2+ palavras: só quando são a mensagem inteira (tolerando
  // "please"/"now"). Fora disso ("...the pain to go away") não disparam.
  return UNSUB_STANDALONE_PHRASES.includes(t) || UNSUB_STANDALONE_PHRASES.includes(stripped);
}
