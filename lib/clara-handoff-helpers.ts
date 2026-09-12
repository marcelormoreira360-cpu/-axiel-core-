// Detector de HANDOFF humano para a Clara (WhatsApp), puro e testável.
//
// Só dispara em casos de ALTA confiança e que o playbook manda passar para uma
// pessoa: (1) pedido explícito de falar com humano, (2) pedido de desconto/condição
// de valor, (3) reembolso/cobrança/disputa. Objeção comum ("está caro", "vou pensar")
// NÃO cai aqui — o modelo trata conversacionalmente. A ideia é ser conservador:
// na dúvida, retorna null e a conversa segue normal.

export type HandoffReason = "human" | "discount" | "billing";

// Pedido explícito de atendente humano (PT/EN/ES), tom natural de WhatsApp.
// Os padrões toleram artigos no meio ("falar com o atendente", "com uma pessoa").
const HUMAN_RE: RegExp[] = [
  /\bfalar\s+com\s+[a-zãáâàéêíóôõúç]{0,6}\s*(atendente|humano|pessoa|recep|equipe|algu[ée]m)\b/i,
  /\b(atendente|recepcionista)\b/i,
  /\bpessoa\s+de\s+verdade\b/i,
  /\bn[ãa]o\s+quero\s+(falar\s+com\s+)?(rob[ôo]|bot|m[áa]quina)/i,
  /\b(talk|speak|chat)\s+(to|with)\s+[a-z\s]{0,10}?(someone|person|human|agent|reception|representative|staff)\b/i,
  /\breal\s+(person|human)\b/i,
  /\b(human|live)\s+agent\b/i,
  /\bhablar\s+con\s+[a-zñáéíóú\s]{0,8}?(algui[eé]n|persona|humano|recepci)/i,
];

// Pedido de desconto/condição de valor: a Clara NUNCA desconta, sempre handoff.
const DISCOUNT_RE: RegExp[] = [
  /\bdescontos?\b/i,
  /\bcupom\b|\bcupons\b/i,
  /\babatimento\b/i,
  /\bdiscounts?\b/i,
  /\bcoupons?\b/i,
  /\bpromo(?:tional|c[óo]digo|\s*code)\b/i,
];

// Reembolso / cobrança / disputa de pagamento.
const BILLING_RE: RegExp[] = [
  /\breembolso\b|\bestorno\b|\bchargeback\b/i,
  /\bcobran[çc]a\b[^.?!]{0,15}(errada|indevida|duplicada|em\s+dobro)/i,
  /\brefund\b|\bchargeback\b/i,
  /\b(wrong|double|duplicate)\s+charge\b/i,
  /\bbilling\s+(issue|problem|error)\b/i,
];

const anyMatch = (text: string, res: RegExp[]): boolean => res.some((re) => re.test(text));

/**
 * Retorna o motivo do handoff se a mensagem pedir claramente um humano / desconto /
 * reembolso; caso contrário null (a conversa segue normal). Prioridade: humano >
 * cobrança > desconto (qualquer um já basta para passar para a equipe).
 */
export function detectHandoffRequest(text: string): HandoffReason | null {
  if (!text || !text.trim()) return null;
  const t = text.toLowerCase();
  if (anyMatch(t, HUMAN_RE)) return "human";
  if (anyMatch(t, BILLING_RE)) return "billing";
  if (anyMatch(t, DISCOUNT_RE)) return "discount";
  return null;
}
