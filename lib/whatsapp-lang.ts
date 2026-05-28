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

  const enWords = [
    " hello ", " hi ", " hey ", "good morning", "good afternoon", "good evening",
    " i ", "i'm ", "i have ", "i've ", "i feel ", "i am ",
    " what ", " how ", " my ", " the ", " is ", " are ", " can ", " do ", " please ",
    " thank", " help", " looking", " want ", " need ", " would ",
    " pain ", " feel ", " years ", " months ", " ago ",
    " treatment", " appointment", " schedule", " book ",
    " cost ", " price ", " available", " when ", " where ", " who ",
    " anxiety", " fatigue", " sleep", " energy", " doctor", " clinic", " health",
  ];
  const ptWords = [
    " olá", " oi ", "bom dia", "boa tarde", "boa noite", "tudo bem",
    " quero", " preciso", " tenho", " estou", " sinto", " dor ",
    " anos ", " meses ", " tratamento", " ajuda", " quanto", " valor",
    " preço", " agendar", " como ", " meu ", " minha ", " você",
    " não ", " sim ", " também", " sempre", " desde", " muito",
    " porque", " então", " assim",
  ];

  const enScore = enWords.filter((w) => lower.includes(w)).length;
  const ptScore = ptWords.filter((w) => lower.includes(w)).length;

  return enScore > ptScore ? "en" : "pt";
}
