// Opt-out TCPA por palavra-chave de SMS.
//
// DISTINTO do "falar com atendente" (lib/whatsapp-optout): aquele é handoff
// humano detectado por FRASE; aqui o paciente pede para NÃO receber mais SMS.
//
// Conservador de propósito: só casa quando a mensagem INTEIRA é uma palavra
// inequívoca de opt-out. Não incluímos "cancelar"/"cancel"/"end" porque numa
// clínica isso costuma significar "cancelar consulta", não "sair do SMS".
// Também não casa dentro de frase (ex.: "quero parar de sentir dor").

const SMS_STOP_KEYWORDS = new Set([
  // Padrão TCPA (EN)
  "stop",
  "stopall",
  "unsubscribe",
  // PT
  "parar",
  "sair",
  "descadastrar",
]);

/** true se a mensagem inteira é uma palavra-chave de opt-out de SMS. */
export function isSmsStopKeyword(text: string): boolean {
  const t = text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[.!?¡¿]+$/g, "") // pontuação final
    .trim();
  return SMS_STOP_KEYWORDS.has(t);
}
