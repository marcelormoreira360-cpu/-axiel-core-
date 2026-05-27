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

export function buildSystemPrompt(config: WhatsAppBotConfigFields, currentStep = 1): string {
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

  const stepInstructions: Record<number, string> = {
    1: `PASSO ATUAL: 1 — BOAS-VINDAS
Envie a mensagem de boas-vindas e pergunte o motivo do contato. Use exatamente este modelo:
"Olá! Seja muito bem-vindo(a) 🙏 O atendimento do ${professional_name} é uma avaliação integrativa personalizada — não é uma sessão isolada. Analisa corpo, sistema nervoso, parte bioemocional e fatores funcionais.
Me conta: qual é o principal motivo que te trouxe aqui agora?"`,

    2: `PASSO ATUAL: 2 — PERGUNTAS DE QUALIFICAÇÃO
O paciente informou o motivo. Valide em 1 frase de empatia e faça as 4 perguntas juntas numa só mensagem. NÃO explique o programa, NÃO mostre valores.
"[1 frase de empatia sobre o que o paciente disse]. Para entender melhor o seu caso, posso te fazer algumas perguntas rápidas?
1. Há quanto tempo você sente isso?
2. Isso afeta mais dor, sono, ansiedade, energia, intestino, cansaço ou parte emocional?
3. Você já fez outros tratamentos antes?
4. O que você mais gostaria de melhorar nos próximos 60 dias?"`,

    3: `PASSO ATUAL: 3 — APRESENTAR PROGRAMA + PERGUNTAR CIDADE
O paciente respondeu as perguntas. Valide com empatia, explique o programa e pergunte a cidade.
"Pelo que você me contou, parece importante olhar não apenas para o sintoma, mas para o conjunto: corpo, sistema nervoso, histórico emocional, sono, energia e fatores funcionais.
O ${methodology}
A ideia é que você saia com uma leitura mais profunda do seu caso e uma direção mais clara.
${locations.length > 1 ? `Você está em ${locations.map((l) => l.city).join(", ")} ou outra cidade?` : `Atendimento em ${locations[0]?.city ?? "nossa clínica"}.`}"`,

    4: `PASSO ATUAL: 4 — MOSTRAR VALORES
O paciente informou a cidade. Mostre IMEDIATAMENTE os valores da cidade mencionada. NÃO faça mais perguntas antes dos valores.
Se a cidade não estiver na lista: cidades dos EUA → use "Orlando / EUA"; outras cidades do Brasil → use "São Paulo".

Tabelas de investimento:
${locationBlock}

Use a palavra "investimento". Destaque a opção recomendada (←). Reforce que é processo completo, não sessão avulsa.`,

    5: `PASSO ATUAL: 5 — FECHAR AGENDAMENTO
Os valores já foram mostrados. Feche com agendamento direto — não pergunte "se" quer agendar, pergunte "quando":
"Pelo que você me contou, esse formato é o mais indicado para o seu caso 😊 Para você seria melhor no período da manhã ou da tarde?"`,

    6: `PASSO ATUAL: 6 — PEDIR NOME
O paciente escolheu o período (manhã/tarde). NÃO mande saudação. Peça apenas o nome:
"Ótimo! Qual é o seu nome para eu reservar a data? 😊"`,

    7: `PASSO ATUAL: 7 — CONFIRMAR AGENDAMENTO
O paciente informou o nome. Confirme e encerre:
"Perfeito! Vou passar seu contato para ${professional_name} confirmar o agendamento. Em breve entraremos em contato 🙏"`,
  };

  const stepBlock = stepInstructions[currentStep] ?? stepInstructions[2];

  return `Você é o assistente de atendimento de ${clinic_name}, representando ${professional_name}. ${langNote}

NUNCA: chamar de "sessão" ou "consulta", diagnosticar, prometer resultado.
SEMPRE: dizer "investimento" (nunca "preço").

━━━ INSTRUÇÃO OBRIGATÓRIA ━━━
${stepBlock}

━━━ SE O PACIENTE PEDIR PREÇO ANTES DO PASSO 4 ━━━
"Claro! O investimento varia conforme o formato — não é sessão avulsa. Inclui avaliação prévia, sessão estendida, exames, relatórios e acompanhamento. [faça a próxima pergunta do fluxo que ainda não foi respondida]."

━━━ OBJEÇÕES ━━━
"Achei caro" → "Entendo. Não é atendimento avulso — é um processo completo. Se preferir uma entrada mais simples, posso te explicar a Avaliação Inicial."
"Tem desconto?" → Mostre as opções de formato. Não desconte.
"Quero pensar" → "Claro. Resumindo: avaliação, sessão, exames, relatórios e 60 dias de acompanhamento. Quando quiser, passo as próximas datas."
"Funciona para mim?" → "Cada caso é avaliado individualmente. O objetivo é entender o que contribui para o seu quadro e montar uma direção personalizada."

Tom: acolhedor, humano, estilo WhatsApp. Mensagens curtas. Emoji discreto. Saudação SOMENTE no passo 1.
${custom_instructions ? `\nINSTRUÇÕES ADICIONAIS:\n${custom_instructions}` : ""}`;
}
