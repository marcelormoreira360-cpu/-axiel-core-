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
  // Normaliza pontuação de FRONTEIRA (vírgula, ponto, etc.) para espaço, para que
  // "Hello," e "information..." casem os padrões com espaço (" hello "). PRESERVA o
  // apóstrofo, senão as contrações "i'm"/"i've" (peso 2) deixariam de casar.
  const lower = ` ${firstUserMsg.toLowerCase()} `
    .replace(/[.,!?;:"()\[\]]/g, " ")
    .replace(/\s+/g, " ");

  // Words weighted by length/uniqueness — short ambiguous words (" i ") get weight
  // 1; longer/unambiguous words get weight 2. EN requires at least 2 points more
  // than PT to switch language (avoids false positives em mensagens curtas do BR).
  //
  // Todos os padrões usam FRONTEIRA de espaço (" x ") — a normalização acima troca
  // pontuação por espaço, então "Stop." / "information..." casam. NÃO inclua tokens
  // que também são palavras curtas do português (" do ", " no ", " as ", " a ", " o "),
  // senão frases em PT viram falso positivo de inglês.
  const enWords: Array<[string, number]> = [
    // saudações e aberturas
    [" hello ", 2], [" hi ", 2], [" hey ", 2], ["good morning", 2], ["good afternoon", 2], ["good evening", 2],
    [" i'm ", 2], [" i have ", 2], [" i've ", 2], [" i feel ", 2], [" i am ", 2], [" i'd ", 2], [" i want ", 2],
    // palavras funcionais do inglês (aparecem em quase toda frase EN, ~ausentes em PT)
    [" the ", 1], [" to ", 1], [" of ", 1], [" and ", 1], [" is ", 1], [" it ", 1], [" for ", 1],
    [" you ", 1], [" your ", 2], [" with ", 1], [" this ", 1], [" that ", 1], [" have ", 1], [" not ", 1],
    [" are ", 1], [" we ", 1], [" be ", 1], [" on ", 1], [" at ", 1], [" in ", 1], [" so ", 1],
    [" but ", 1], [" or ", 1], [" if ", 1], [" an ", 1], [" up ", 1], [" out ", 1], [" off ", 1],
    [" me ", 1], [" my ", 2], [" can ", 1], [" don't ", 2], [" dont ", 2], [" can't ", 2], [" won't ", 2],
    // intenção / opt-out / conteúdo
    [" what ", 1], [" how ", 1], [" when ", 1], [" where ", 1], [" who ", 1], [" why ", 1],
    [" please ", 2], [" thank ", 2], [" thanks ", 2], [" help ", 1], [" looking ", 2],
    [" want ", 1], [" need ", 1], [" would ", 2], [" more ", 1], [" here ", 1], [" now ", 1],
    [" just ", 2], [" stop ", 2], [" scrolling ", 2], [" text ", 1], [" call ", 1], [" message ", 2],
    [" info ", 2], [" information ", 2], [" interested ", 2], [" remove ", 2], [" unsubscribe ", 2], [" list ", 1],
    [" pain ", 2], [" feel ", 1], [" years ", 2], [" months ", 2], [" ago ", 1],
    [" treatment ", 2], [" appointment ", 2], [" schedule ", 2], [" book ", 1],
    [" cost ", 1], [" price ", 2], [" available ", 2],
    [" anxiety ", 2], [" fatigue ", 2], [" sleep ", 2], [" energy ", 2], [" doctor ", 2], [" clinic ", 2], [" health ", 2],
    [" i ", 1],  // peso baixo — comum dentro de palavras do português (ex.: "ali")
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
