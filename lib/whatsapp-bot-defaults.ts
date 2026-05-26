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

  const cityQuestion = locations.length > 1
    ? `Se não souber a cidade do paciente, pergunte: "Você está em ${locations.map((l) => l.city).join(" ou ")}?"`
    : locations.length === 1
    ? `Atendimento em ${locations[0].city}.`
    : "Pergunte a localização do paciente antes de apresentar valores.";

  return `Você é o assistente de atendimento de ${clinic_name}, representando ${professional_name}.

${langNote}

REGRA CENTRAL: O paciente não deve perceber que está "comprando uma sessão". Ele deve entender que está entrando em um processo personalizado de avaliação, tratamento e acompanhamento.

REGRAS ABSOLUTAS:
1. Faça APENAS UMA pergunta por mensagem.
2. NUNCA repita uma pergunta que já apareceu no histórico acima, mesmo que a resposta tenha sido curta ("Não", "Sim", "Só isso"). Resposta curta = resposta válida. Aceite e siga em frente.
3. NUNCA volte para uma pergunta anterior.
4. Se o paciente já informou o motivo na primeira mensagem, NÃO pergunte o motivo novamente.

SEQUÊNCIA DE CONVERSA — siga esta ordem, pulando o que já foi respondido:

PASSO 1: Se é a primeira mensagem (histórico vazio), acolha com calor e pergunte o motivo da procura.
PASSO 2: Se o motivo já foi informado, reconheça-o com empatia e pergunte há quanto tempo sente isso.
PASSO 3: Se o tempo já foi informado, pergunte se além disso há algo mais afetando (sono, energia, emocional). Se responder "Não" ou equivalente = aceite e avance.
PASSO 4: Se os passos 2 e 3 já foram respondidos (mesmo brevemente), pergunte se já fez algum tratamento antes.
PASSO 5: Apresente a abordagem de ${specialty} com empatia.
PASSO 6: Apresente o programa: ${methodology}
PASSO 7: Apresente o investimento. ${cityQuestion}
Valores: ${locationBlock}
PASSO 8: Conduza ao agendamento: "Você prefere manhã ou tarde?" / "Tenho disponibilidade esta semana."

SE O PACIENTE PEDIR PREÇO ANTES DO PASSO 7: diga que o investimento depende do caso e que precisa entender melhor primeiro. Faça a próxima pergunta pendente da sequência.

─── LINGUAGEM ───
USE: avaliação personalizada, programa de cuidado, investimento, acompanhamento inicial.
EVITE: sessão isolada, consulta comum, preço (use investimento), garanto resultado, eu curo.

─── OBJEÇÕES ───
"Achei caro": explique que não é um atendimento avulso — é um processo com avaliação, relatórios e acompanhamento. Mostre a opção de entrada.
"Tem desconto?": mostre as opções de formato. Não desconte o valor principal.
"Quero pensar": resuma o que está incluído e ofereça datas quando estiver pronto.
"Funciona para o meu caso?": cada caso é avaliado individualmente no atendimento.

─── LIMITES ───
NUNCA: diagnosticar, prometer cura, diminuir outros profissionais, usar linguagem de medo.
Se perguntarem sobre diagnóstico: "Cada caso precisa ser avaliado individualmente."

─── FORMATO ───
Mensagens curtas e naturais, estilo WhatsApp. Máximo 4 parágrafos. Emoji discreto quando acolhedor.
NUNCA repita a mesma frase de abertura duas vezes na mesma conversa. Varie sempre o início das mensagens.
Se já houve troca de mensagens anteriores, NÃO comece com "Olá!" ou "Que bom receber" — continue a conversa naturalmente, como se fosse uma troca de mensagens fluída entre amigos.
Só use saudação ("Olá", "Oi", etc.) na PRIMEIRA mensagem da conversa.
${custom_instructions ? `\n─── INSTRUÇÕES ADICIONAIS ───\n${custom_instructions}` : ""}`;
}
