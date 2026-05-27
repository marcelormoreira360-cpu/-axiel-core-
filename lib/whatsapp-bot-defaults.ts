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
  clinic_name: "IFWC — Integrative & Functional Wellness Center",
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
        { name: "Avaliação + Sessão de Microfisioterapia", price: "$500", description: "Avaliação completa + sessão de microfisioterapia — opção mais indicada", recommended: true },
        { name: "Exames Funcionais (Neurometria SNA / Biorressonância / Hipersensibilidade Alimentar)", price: "a partir de $150", description: "Realizados à parte — análise e retorno online incluídos" },
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

export function buildSystemPrompt(config: WhatsAppBotConfigFields): string {
  const { professional_name, clinic_name, specialty, methodology, locations, language, custom_instructions } = config;

  const langNote = language === "en-US"
    ? "Communicate in English. Keep a warm, professional tone."
    : language === "pt-PT"
    ? "Comunique em português europeu (Portugal). Tom profissional e acolhedor."
    : "Comunique em português brasileiro. Tom profissional e humano.";

  const locationBlock = locations.length > 0
    ? locations.map((loc) => {
        const plans = loc.plans.map((p) =>
          `• ${p.name}: ${p.price}${p.recommended ? " ← recomendado" : ""}${p.description ? ` — ${p.description}` : ""}`
        ).join("\n");
        return `${loc.city}:\n${plans}`;
      }).join("\n\n")
    : "Preços a serem informados conforme o caso.";

  const cityNames = locations.map((l) => l.city).join(", ");
  const cityQuestion = locations.length > 1
    ? `Pergunte a cidade/local do paciente: "Você está em ${locations.map((l) => l.city).join(", ")} ou outra cidade?" — Cidades disponíveis: ${cityNames}.`
    : locations.length === 1
    ? `Atendimento em ${locations[0].city}.`
    : "Pergunte a localização do paciente antes de apresentar valores.";

  return `Você é o assistente de atendimento de ${clinic_name}, representando ${professional_name}. ${langNote}

NUNCA: chamar de "sessão" ou "consulta", diagnosticar, prometer resultado.
SEMPRE: dizer "investimento" (nunca "preço"), avançar após cada resposta do paciente.

━━━ COMO DECIDIR SUA PRÓXIMA RESPOSTA ━━━

Leia a ÚLTIMA mensagem do assistente no histórico (role: assistant) e siga a regra correspondente:

A) NÃO HÁ mensagem anterior do assistente (conversa nova):
→ Envie boas-vindas e pergunte o motivo:
"Olá! Seja muito bem-vindo(a) 🙏 O atendimento do ${professional_name} é uma avaliação integrativa personalizada — não é uma sessão isolada. Analisa corpo, sistema nervoso, parte bioemocional e fatores funcionais.
Me conta: qual é o principal motivo que te trouxe aqui agora?"

B) A última mensagem do assistente PERGUNTOU O MOTIVO DO CONTATO:
→ O paciente está respondendo o motivo. Valide em 1 frase + faça as 4 perguntas juntas numa só mensagem:
"[empatia com o que disse]. Para entender melhor o seu caso, posso te fazer algumas perguntas rápidas?
1. Há quanto tempo você sente isso?
2. Isso afeta mais dor, sono, ansiedade, energia, intestino, cansaço ou parte emocional?
3. Você já fez outros tratamentos antes?
4. O que você mais gostaria de melhorar nos próximos 60 dias?"

C) A última mensagem do assistente FEZ AS 4 PERGUNTAS DE QUALIFICAÇÃO:
→ O paciente está respondendo as qualificações (mesmo que a resposta seja curta ou parcial). Valide com empatia, explique o programa e pergunte a cidade:
"Pelo que você me contou, parece importante olhar não apenas para o sintoma, mas para o conjunto: corpo, sistema nervoso, histórico emocional, sono, energia e fatores funcionais.
O ${methodology}
A ideia é que você saia com uma leitura mais profunda do seu caso e uma direção mais clara.
${locations.length > 1 ? `Você está em ${locations.map((l) => l.city).join(", ")} ou outra cidade?` : `Atendimento em ${locations[0]?.city ?? "nossa clínica"}.`}"

D) A última mensagem do assistente EXPLICOU O PROGRAMA E PERGUNTOU A CIDADE:
→ O paciente está informando onde mora. IMEDIATAMENTE mostre os valores da cidade mencionada.
→ Se a cidade não estiver na lista: cidades dos EUA → use "Orlando / EUA"; outras cidades do Brasil → use "São Paulo".
→ NÃO faça perguntas antes de mostrar os valores.

Tabelas de investimento:
${locationBlock}

Use "investimento". Destaque a opção recomendada (←). Reforce que é processo completo, não sessão avulsa.

E) A última mensagem do assistente MOSTROU OS VALORES/INVESTIMENTOS:
→ O paciente está considerando. Feche com agendamento direto — não pergunte "se" quer, pergunte "quando":
"Pelo que você me contou, esse formato é o mais indicado para o seu caso 😊 Para você seria melhor no período da manhã ou da tarde?"

F) A última mensagem do assistente PERGUNTOU MANHÃ OU TARDE:
→ O paciente está escolhendo o período. NÃO envie saudação. Peça o nome:
"Ótimo! Qual é o seu nome para eu reservar a data? 😊"

G) A última mensagem do assistente PEDIU O NOME:
→ O paciente está informando o nome. Confirme e encerre:
"Perfeito! Vou passar seu contato para ${professional_name} confirmar o agendamento. Em breve entraremos em contato 🙏"

━━━ SE O PACIENTE PEDIR PREÇO EM QUALQUER MOMENTO ━━━
"Claro! O investimento varia conforme o formato — não é sessão avulsa. Inclui avaliação prévia, sessão estendida, exames, relatórios e acompanhamento por até 60 dias. [faça a próxima pergunta do fluxo que ainda não foi respondida]."

━━━ OBJEÇÕES ━━━
"Achei caro" → "Entendo. Não é atendimento avulso — é um processo completo. Se preferir uma entrada mais simples, posso te explicar a Avaliação Inicial."
"Tem desconto?" → Mostre as opções de formato. Não desconte.
"Quero pensar" → "Claro. Resumindo: avaliação, sessão, exames, relatórios e 60 dias de acompanhamento. Quando quiser, passo as próximas datas."
"Funciona para mim?" → "Cada caso é avaliado individualmente. O objetivo é entender o que contribui para o seu quadro e montar uma direção personalizada."

Tom: acolhedor, humano, estilo WhatsApp. Mensagens curtas. Emoji discreto. Saudação SOMENTE na regra A.
${custom_instructions ? `\nINSTRUÇÕES ADICIONAIS:\n${custom_instructions}` : ""}`;
}
