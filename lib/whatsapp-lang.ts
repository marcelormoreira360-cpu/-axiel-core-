/**
 * Shared language detection for WhatsApp flows.
 * Used by both the Meta webhook and the booking confirmation route.
 */

export type Lang = "pt" | "en";

interface ChatMessage {
  role: string;
  content: string;
}

/**
 * Detects PT vs EN from the first user message in a conversation.
 * Requires EN to outscore PT by at least 1 to avoid false positives
 * on short / ambiguous messages. Defaults to "pt".
 */
export function detectLanguage(messages: ChatMessage[], currentMessage: string): Lang {
  const firstUserMsg = messages.find((m) => m.role === "user")?.content ?? currentMessage;
  const lower = ` ${firstUserMsg.toLowerCase()} `;

  // DEBT-08: words weighted by length/uniqueness — short ambiguous words (" i ", " do ")
  // get weight 1; longer/unambiguous words get weight 2.
  // EN requires at least 2 points more than PT to switch language (avoids false positives).
  const enWords: Array<[string, number]> = [
    [" hello ", 2], [" hi ", 2], [" hey ", 2], ["good morning", 2], ["good afternoon", 2], ["good evening", 2],
    ["i'm ", 2], ["i have ", 2], ["i've ", 2], ["i feel ", 2], ["i am ", 2],
    [" what ", 1], [" how ", 1], [" my ", 2], [" the ", 1], [" is ", 1], [" are ", 1], [" can ", 1], [" please ", 2],
    [" thank", 2], [" help", 1], [" looking", 2], [" want ", 1], [" need ", 1], [" would ", 2],
    [" pain ", 2], [" feel ", 1], [" years ", 2], [" months ", 2], [" ago ", 1],
    [" treatment", 2], [" appointment", 2], [" schedule", 2], [" book ", 1],
    [" cost ", 1], [" price ", 2], [" available", 2], [" when ", 1], [" where ", 1], [" who ", 1],
    [" anxiety", 2], [" fatigue", 2], [" sleep", 2], [" energy", 2], [" doctor", 2], [" clinic", 2], [" health", 2],
    [" i ", 1],  // low weight — common in portuguese words (e.g., "ali")
  ];
  const ptWords: Array<[string, number]> = [
    [" olá", 2], [" oi ", 2], ["bom dia", 2], ["boa tarde", 2], ["boa noite", 2], ["tudo bem", 2],
    [" quero", 2], [" preciso", 2], [" tenho", 2], [" estou", 2], [" sinto", 2], [" dor ", 2],
    [" anos ", 2], [" meses ", 2], [" tratamento", 2], [" ajuda", 2], [" quanto", 2], [" valor", 2],
    [" preço", 2], [" agendar", 2], [" como ", 1], [" meu ", 2], [" minha ", 2], [" você", 2],
    [" não ", 2], [" sim ", 2], [" também", 2], [" sempre", 2], [" desde", 2], [" muito", 2],
    [" porque", 2], [" então", 2], [" assim", 2], [" para ", 1], [" com ", 1], [" uma ", 1], [" que ", 1],
  ];

  const enScore = enWords.reduce((sum, [w, weight]) => lower.includes(w) ? sum + weight : sum, 0);
  const ptScore = ptWords.reduce((sum, [w, weight]) => lower.includes(w) ? sum + weight : sum, 0);

  // Require EN to outscore PT by at least 2 points to avoid false positives on short messages
  return enScore >= ptScore + 2 ? "en" : "pt";
}
