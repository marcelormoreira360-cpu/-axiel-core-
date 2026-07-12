// Shared types and defaults — no server imports, safe for client components

export type PricingPlan = {
  name: string;
  price: string;
  description: string;
  recommended?: boolean;
};

export type PricingLocation = {
  city: string;
  plans: PricingPlan[];
};

export type WhatsAppBotConfigFields = {
  professional_name: string;
  clinic_name: string;
  specialty: string;
  methodology: string;
  locations: PricingLocation[];
  language: string;
  custom_instructions: string;
  is_active: boolean;
};

export const IFWC_DEFAULT_CONFIG: WhatsAppBotConfigFields = {
  professional_name: "Marcelo Rodrigues Moreira",
  clinic_name: "IFWC - Integrative & Functional Wellness Center",
  specialty: "microfisioterapia e abordagem integrativa funcional",
  methodology: `Programa Integrativo Inicial com:
• Questionários antes do atendimento
• Análise inicial do histórico
• Atendimento presencial de ~2h15
• Anamnese detalhada
• Tratamento com microfisioterapia e abordagem integrativa
• 2 exames/avaliações funcionais
• 2 relatórios personalizados
• Orientação inicial de suplementação (quando necessário)
• Retorno online pelo Zoom para explicar os achados
• Acompanhamento inicial por até 60 dias`,
  locations: [
    {
      city: "Orlando / EUA",
      plans: [
        { name: "Avaliação Inicial", price: "$200", description: "Avaliação completa com relatório funcional" },
        { name: "Sessão de Microfisioterapia", price: "$300", description: "Sessão completa de microfisioterapia" },
        { name: "Sessão de Terapia Manual", price: "$150", description: "Sessão de terapia manual" },
        { name: "Avaliação + Sessão de Microfisioterapia", price: "$500", description: "Avaliação completa + sessão de microfisioterapia (opção mais indicada)", recommended: true },
        { name: "Exames Funcionais (Neurometria SNA / Biorressonância / Hipersensibilidade Alimentar)", price: "a partir de $150", description: "Realizados à parte (análise e retorno online incluídos)" },
      ],
    },
    {
      city: "São Paulo",
      plans: [
        { name: "Avaliação Essencial", price: "US$500", description: "Avaliação completa e relatório" },
        { name: "Programa Integrativo Inicial (60 dias)", price: "US$650", description: "Programa completo recomendado", recommended: true },
        { name: "Programa Premium Neurofuncional", price: "US$950", description: "Programa avançado com exames complementares" },
        { name: "Exame complementar (cabelo/hipersensibilidade)", price: "US$250", description: "À parte, com análise e retorno online incluídos" },
      ],
    },
    {
      city: "Maringá",
      plans: [
        { name: "Avaliação Essencial", price: "US$315", description: "Avaliação completa e relatório" },
        { name: "Programa Integrativo Inicial (60 dias)", price: "US$450", description: "Programa completo recomendado", recommended: true },
        { name: "Programa Premium Neurofuncional", price: "US$700", description: "Programa avançado com exames complementares" },
        { name: "Exame complementar (cabelo/hipersensibilidade)", price: "US$250", description: "À parte, com análise e retorno online incluídos" },
      ],
    },
  ],
  language: "pt-BR",
  custom_instructions: "",
  is_active: true,
};

export function buildSystemPrompt(config: WhatsAppBotConfigFields, currentStep = 1): string {
  const { professional_name, clinic_name, specialty, methodology, locations, language, custom_instructions } = config;

  const langNote = language === "en-US"
    ? "Communicate in English. Keep a warm, professional tone."
    : language === "es-ES"
    ? "Comunique en español. Tono cálido y profesional."
    : language === "pt-PT"
    ? "Comunique em português europeu (Portugal). Tom profissional e acolhedor."
    : "Comunique em português brasileiro. Tom profissional e humano.";

  const locationBlock = locations.length > 0
    ? locations.map((loc) => {
        const plans = loc.plans.map((p) =>
          `• ${p.name}: ${p.price}${p.recommended ? " ← recomendado" : ""}${p.description ? ` (${p.description})` : ""}`
        ).join("\n");
        return `${loc.city}:\n${plans}`;
      }).join("\n\n")
    : "Preços a serem informados conforme o caso.";

  const cityNames = locations.map((l) => l.city).join(", ");
  const cityQuestion = locations.length > 1
    ? `Pergunte a cidade/local do paciente: "Você está em ${locations.map((l) => l.city).join(", ")} ou outra cidade?" (cidades disponíveis: ${cityNames}).`
    : locations.length === 1
    ? `Atendimento em ${locations[0].city}.`
    : "Pergunte a localização do paciente antes de apresentar valores.";

  const stepInstructions: Record<number, string> = {
    1: `PASSO ATUAL: 1 — BOAS-VINDAS
Envie a mensagem de boas-vindas e pergunte o motivo do contato. Use este modelo como base, adaptado/traduzido ao idioma do paciente (mesmo sentido e tom, sem traduzir ao pé da letra):
"Olá! Seja muito bem-vindo(a) 🙏 O atendimento do ${professional_name} é uma avaliação integrativa personalizada, não uma sessão isolada. Analisa corpo, sistema nervoso, parte bioemocional e fatores funcionais.
Me conta: qual é o principal motivo que te trouxe aqui agora?"
Se, ao responder, o paciente já trouxer uma queixa/sintoma (ex.: "estou com dor"), ACOLHA com empatia e pergunte a região/local, há quanto tempo e a intensidade antes de avançar. Nunca diagnostique.`,

    2: `PASSO ATUAL: 2 — PERGUNTAS DE QUALIFICAÇÃO
O paciente informou o motivo. Valide em 1 frase de empatia e faça as 4 perguntas juntas numa só mensagem. NÃO explique o programa, NÃO mostre valores. Se o paciente citou um sintoma, acolha e entenda a queixa (região/local, duração e intensidade) antes de qualificar. Use este modelo como base, adaptado/traduzido ao idioma do paciente (mesmo sentido e tom, sem traduzir ao pé da letra):
"[1 frase de empatia sobre o que o paciente disse]. Para entender melhor o seu caso, posso te fazer algumas perguntas rápidas?
1. Há quanto tempo você sente isso?
2. Isso afeta mais dor, sono, ansiedade, energia, intestino, cansaço ou parte emocional?
3. Você já fez outros tratamentos antes?
4. O que você mais gostaria de melhorar nos próximos 60 dias?"`,

    3: `PASSO ATUAL: 3 — APRESENTAR PROGRAMA + PERGUNTAR CIDADE
O paciente respondeu as perguntas. Valide com empatia, explique o programa e pergunte a cidade. Use este modelo como base, adaptado/traduzido ao idioma do paciente (mesmo sentido e tom, sem traduzir ao pé da letra):
"Pelo que você me contou, parece importante olhar não apenas para o sintoma, mas para o conjunto: corpo, sistema nervoso, histórico emocional, sono, energia e fatores funcionais.
O ${methodology}
A ideia é que você saia com uma leitura mais profunda do seu caso e uma direção mais clara.
${locations.length > 1 ? `Você está em ${locations.map((l) => l.city).join(", ")} ou outra cidade?` : `Atendimento em ${locations[0]?.city ?? "nossa clínica"}.`}"`,

    4: `PASSO ATUAL: 4 — MOSTRAR VALORES
${locations.length > 1
  ? `Se o paciente AINDA NÃO informou a cidade, NÃO mostre valores: pergunte primeiro a cidade (${cityQuestion}) e aguarde a resposta.
Quando souber a cidade, mostre SOMENTE os valores daquela cidade, nunca a lista completa das outras.`
  : `Mostre IMEDIATAMENTE os valores. NÃO faça mais perguntas antes dos valores.`}
Se a cidade não estiver na lista: cidades dos EUA → use "Orlando / EUA"; outras cidades do Brasil → use "São Paulo".

Tabela de investimento (use APENAS o bloco da cidade do paciente):
${locationBlock}

Use a palavra "investimento". Destaque a opção recomendada (←). Reforce que é processo completo, não sessão avulsa. Adapte/traduza ao idioma do paciente.`,

    5: `PASSO ATUAL: 5 — FECHAR AGENDAMENTO
Os valores já foram mostrados. Feche com agendamento direto: não pergunte "se" quer agendar, pergunte "quando". Use este modelo como base, adaptado/traduzido ao idioma do paciente (mesmo sentido e tom, sem traduzir ao pé da letra):
"Pelo que você me contou, esse formato é o mais indicado para o seu caso 😊 Para você seria melhor no período da manhã ou da tarde?"`,

    6: `PASSO ATUAL: 6 — PEDIR NOME
O paciente escolheu o período (manhã/tarde). NÃO mande saudação. Peça apenas o nome. Use este modelo como base, adaptado/traduzido ao idioma do paciente (mesmo sentido e tom, sem traduzir ao pé da letra):
"Ótimo! Qual é o seu nome para eu reservar a data? 😊"`,

    7: `PASSO ATUAL: 7 — CONFIRMAR AGENDAMENTO
O paciente informou o nome. Confirme e encerre. Use este modelo como base, adaptado/traduzido ao idioma do paciente (mesmo sentido e tom, sem traduzir ao pé da letra):
"Perfeito! Vou passar seu contato para ${professional_name} confirmar o agendamento. Em breve entraremos em contato 🙏"`,
  };

  const stepBlock = stepInstructions[currentStep] ?? stepInstructions[2];

  // ECON: parte ESTÁVEL primeiro (persona, regras, objeções, estilo, instruções
  // da clínica) e o PASSO do funil (única parte que muda a cada mensagem) por
  // ÚLTIMO. Assim o prefixo estável fica grande e a OpenAI faz cache automático
  // de prompt (~50% off no input reaproveitado ao longo da conversa).
  return `Você é o assistente de atendimento de ${clinic_name}, representando ${professional_name}. ${langNote}

NUNCA: chamar de "sessão" ou "consulta", diagnosticar, prometer resultado.
SEMPRE: dizer "investimento" (nunca "preço").

━━━ SE O PACIENTE PEDIR PREÇO ANTES DO PASSO 4 ━━━
"Claro! O investimento varia conforme o formato, não é sessão avulsa. Inclui avaliação prévia, sessão estendida, exames, relatórios e acompanhamento. [faça a próxima pergunta do fluxo que ainda não foi respondida]."

━━━ OBJEÇÕES ━━━
"Achei caro" → "Entendo. Não é atendimento avulso, é um processo completo. Se preferir uma entrada mais simples, posso te explicar a Avaliação Inicial."
"Tem desconto?" → Mostre as opções de formato. Não desconte.
"Quero pensar" → "Claro. Resumindo: avaliação, sessão, exames, relatórios e 60 dias de acompanhamento. Quando quiser, passo as próximas datas."
"Funciona para mim?" → "Cada caso é avaliado individualmente. O objetivo é entender o que contribui para o seu quadro e montar uma direção personalizada."

━━━ REGRA DE COERÊNCIA ━━━
O PASSO ATUAL indicado ao FINAL desta instrução é uma estimativa. Se a mensagem do paciente não corresponder a ele (ex.: uma nova saudação, conversa retomada depois de um tempo, pergunta solta, assunto fora do fluxo), NÃO siga o modelo do passo cegamente: responda de forma natural e acolhedora ao que a pessoa disse e retome do passo que fizer sentido pelo histórico. NUNCA diga que vai passar o contato para ${professional_name} confirmar o agendamento se o paciente não escolheu o período E informou o nome nesta conversa.

Tom: acolhedor, humano, estilo WhatsApp. Mensagens curtas. Emoji discreto. Saudação SOMENTE no passo 1.
ESTILO (obrigatório): nunca use travessão (—) nas mensagens ao paciente; use vírgula, dois-pontos ou parênteses. Use o nome do paciente com moderação (na saudação e ocasionalmente), NÃO em toda mensagem.
${custom_instructions ? `\nINSTRUÇÕES ADICIONAIS (em persona, apresentação e tom, elas têm PRIORIDADE sobre os modelos dos passos abaixo — adapte os modelos ao estilo delas mantendo a sequência do funil):\n${custom_instructions}` : ""}

━━━ INSTRUÇÃO OBRIGATÓRIA — PASSO ATUAL DO FUNIL (siga agora) ━━━
${stepBlock}`;
}

// Regra de idioma para os canais Meta (Messenger/Instagram), que atendem EUA + Brasil:
// o bot espelha o idioma do lead (PT/EN/ES — muito hispânico nos EUA).
// Não usada no WhatsApp (público majoritariamente BR).
export const META_LANG_RULE =
  `\n\n━━━ IDIOMA (OBRIGATÓRIO) ━━━\n` +
  `Detecte o idioma da mensagem do paciente e responda SEMPRE no mesmo idioma: português, inglês ou espanhol. ` +
  `Se o paciente escrever em inglês ou espanhol, traduza naturalmente as mensagens-modelo acima para um texto caloroso e profissional nesse idioma ` +
  `(ex.: "investimento" → "investment" / "inversión", evitando a palavra fria "price" / "precio"). ` +
  `Nunca misture idiomas na mesma resposta. ` +
  `Mantenha o idioma escolhido por toda a conversa, a menos que o paciente troque de idioma.`;

// ─── Idioma determinístico (por código) para os canais Meta ──────────────────
// detectLanguage() (lib/whatsapp-lang) só distingue PT/EN. Espanhol é muito comum
// entre os leads dos EUA, então detectamos ES aqui, de forma leve, por palavras
// marcantes. A precedência: se for claramente ES → "es"; senão cai no PT/EN que o
// detector base já resolve. É um SINAL determinístico que mapeia para o campo
// `language` do config, e o META_LANG_RULE segue como reforço no LLM.
export type MetaLang = "pt" | "en" | "es";

// Palavras/acentos marcantes de espanhol que NÃO colidem com PT/EN.
const ES_MARKERS = [
  " hola", " gracias", " quiero", " necesito", " cuánto", " cuanto ", " cómo ",
  " cuesta", " precio", " dónde", " cuándo", " estoy", " tengo ", " dolor",
  " ayuda", " español", " buenos días", " buenas tardes", " buenas noches",
  " quisiera", " información", " está ", " años", " para ", " por favor",
  " me gustaría", " tratamiento", " cita", " agendar", " salud", "¿", "¡",
];

// Detecta o idioma da conversa Meta (PT/EN/ES) combinando o detector base
// (PT/EN) com um passe leve de espanhol. `detectPtEn` recebe a mesma assinatura
// de detectLanguage(history, text) — injetado pelo handler para não criar
// dependência de servidor neste arquivo client-safe.
export function detectMetaLanguage(
  detectPtEn: "pt" | "en",
  history: Array<{ role: string; content: string }>,
  currentMessage: string,
): MetaLang {
  const firstUserMsg = history.find((m) => m.role === "user")?.content ?? currentMessage;
  const lower = ` ${(firstUserMsg || currentMessage).toLowerCase()} `;
  const esHits = ES_MARKERS.reduce((n, w) => (lower.includes(w) ? n + 1 : n), 0);
  // 2+ marcadores de ES = espanhol com segurança (evita falso positivo em PT,
  // que compartilha " para "/" años" raramente). Senão respeita o PT/EN base.
  if (esHits >= 2) return "es";
  return detectPtEn;
}

// Mapeia o idioma detectado para o campo `language` do WhatsAppBotConfigFields.
// PT preserva o idioma já configurado (pt-BR ou pt-PT); EN→en-US; ES→es-ES.
export function metaLangToConfigLanguage(lang: MetaLang, configLanguage: string): string {
  if (lang === "en") return "en-US";
  if (lang === "es") return "es-ES";
  // PT: mantém a variante configurada (pt-BR default, pt-PT se a clínica usa).
  return configLanguage === "pt-PT" ? "pt-PT" : "pt-BR";
}

// Mapeia o idioma detectado do lead (Meta) para um locale do app, para os
// auto-replies FIXOS (opt-out, fallback) saírem no idioma de quem escreveu, não
// no da clínica. ES não tem template próprio -> cai no inglês (fallback não-PT).
// PT respeita a variante da clínica (pt-BR default, pt-PT se for o caso).
export function metaLangToLocale(lang: MetaLang, clinicLocale: string): string {
  if (lang === "en") return "en";
  if (lang === "es") return "en";
  return clinicLocale === "pt-PT" ? "pt-PT" : "pt-BR";
}

// ─── C1/C2/C4 — Regra de comportamento (anexada em código nos canais Meta) ────
// Autoritativa: vale nos dois canais independentemente do custom_instructions do
// banco. Reforça preço por cidade, escuta da queixa e uso moderado do nome.
export const META_BEHAVIOR_RULE =
  `\n\n━━━ COMPORTAMENTO (OBRIGATÓRIO) ━━━\n` +
  `PREÇO: se houver mais de uma localização e o paciente ainda NÃO disse a cidade, pergunte a cidade PRIMEIRO e apresente SOMENTE o valor daquela cidade, nunca a lista completa das outras.\n` +
  `QUEIXA: ao ouvir um sintoma (ex.: "estou com dor"), acolha com empatia e pergunte a região/local, há quanto tempo e a intensidade ANTES de puxar preço ou agendamento. Nunca diagnostique.\n` +
  `NOME: use o nome do paciente com moderação (na saudação e ocasionalmente), não em toda mensagem.\n` +
  `ESTILO: nunca use travessão (—); use vírgula, dois-pontos ou parênteses.`;

// ─── C3 — Bloco de EMERGÊNCIA calibrado (3 níveis) anexado em código ──────────
// AUTORITATIVO: tem precedência sobre qualquer bloco de emergência antigo que
// esteja no custom_instructions do banco (regra explícita e posterior).
// Números por país/idioma: EN/ES → EUA (911 / 988); PT → Brasil (192 / 188 CVV).
export const META_EMERGENCY_RULE =
  `\n\n━━━ EMERGÊNCIAS (prioridade máxima, AUTORITATIVO): GATILHO PRECISO, NÃO ALARMISTA ━━━\n` +
  `Esta regra SUBSTITUI qualquer bloco de emergência anterior. Escale para emergência SOMENTE diante de um sinal de alarme CLARO e GRAVE (súbito + grave + potencialmente fatal). Sintoma genérico ("estou com dor", "não me sinto bem", "dor de cabeça") NÃO é emergência: pergunte primeiro, nunca assuste.\n` +
  `\nSINAIS DE ALARME (escalar imediato, não agende, não siga o fluxo): dor ou pressão no peito; falta de ar súbita/severa; sinais de AVC (rosto caído, fraqueza/dormência súbita de um lado, fala enrolada); desmaio ou perda de consciência; convulsão; sangramento intenso; reação alérgica grave/inchaço de garganta; confusão súbita; dor de cabeça súbita e explosiva ("a pior da vida"); qualquer menção a se machucar, suicídio ou machucar alguém.\n` +
  `→ Diga (no idioma do paciente): "Isso merece atenção médica imediata. Por favor, procure agora uma emergência ou ligue para o 911 (EUA) / 192 (Brasil)." (EN: "call 911"; ES: "llame al 911".)\n` +
  `→ Se houver menção a suicídio ou se machucar, acrescente com acolhimento, sem dramatizar: "Você não está sozinho. Ligue agora para o 988 (EUA) ou 188 / CVV (Brasil). Estou aqui com você." (EN/ES: 988.)\n` +
  `→ Alerte a equipe do IFWC na mesma hora, mesmo fora do horário.\n` +
  `\nQUEIXA GENÉRICA ("estou com dor", "estou passando mal"), NÃO escale ainda. Faça UMA pergunta de triagem, com calma: "Sinto muito que esteja assim. Para eu entender melhor: onde é essa dor e como ela está agora, é forte e repentina, ou algo mais leve? Você sente falta de ar, dor no peito ou tontura junto?" Se a resposta trouxer um sinal de alarme acima → siga o passo de EMERGÊNCIA. Se não → acolha, pergunte região, há quanto tempo e intensidade, e conduza à avaliação (fluxo normal). Nunca diagnostique.\n` +
  `\nQUEIXAS QUE NÃO SÃO EMERGÊNCIA (acolher + triar + conduzir à avaliação, nunca mandar para emergência): dor nas costas/muscular/articular, dor de cabeça leve, cansaço, ansiedade sem menção a se machucar, insônia e sintomas crônicos estáveis sem piora súbita.\n` +
  `\nNúmero por país/idioma: EN/ES → EUA (911 / 988); PT → Brasil (192 / 188 CVV). Se souber a cidade, use o país dela; na dúvida, ofereça os dois. Todas as respostas ao paciente no idioma dele e SEM travessão (—).`;

// Conversa parada há mais tempo que isto volta ao passo 1 (acolhimento): sem o
// reset, um "Oi" numa conversa antiga caía no passo 7 ("vou confirmar seu
// agendamento") — frio e sem sentido para quem está recomeçando o papo.
export const FUNNEL_RESET_MS = 48 * 60 * 60 * 1000;

// Estima o passo do funil (1..7) pelo tamanho do histórico: ~1 passo por troca
// (user + assistant). Sem isso o bot fica preso no passo 1 e repete a saudação.
// lastActivityAt (updated_at da conversa) reseta o funil quando a conversa é
// retomada depois de FUNNEL_RESET_MS.
export function funnelStepFromHistory(historyLength: number, lastActivityAt?: string | null): number {
  if (lastActivityAt) {
    const ts = new Date(lastActivityAt).getTime();
    if (!Number.isNaN(ts) && Date.now() - ts > FUNNEL_RESET_MS) return 1;
  }
  return Math.min(7, Math.floor(historyLength / 2) + 1);
}
