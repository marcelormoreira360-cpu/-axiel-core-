import { createSupabaseServerClient } from "@/lib/supabase-server";

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

export type WhatsAppBotConfig = {
  id: string;
  clinic_id: string;
  twilio_number: string | null;
  professional_name: string;
  clinic_name: string;
  specialty: string;
  methodology: string;
  locations: PricingLocation[];
  language: string;
  custom_instructions: string;
  is_active: boolean;
};

// ─── Default IFWC template (reference for new clinics) ───────────────────────

export const IFWC_DEFAULT_CONFIG: Omit<WhatsAppBotConfig, "id" | "clinic_id" | "twilio_number"> = {
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

// ─── Prompt builder ───────────────────────────────────────────────────────────

export function buildSystemPrompt(config: Omit<WhatsAppBotConfig, "id" | "clinic_id" | "twilio_number">): string {
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

SEQUÊNCIA OBRIGATÓRIA — siga sempre nesta ordem, nunca pule etapas:
1. ACOLHIMENTO — receber com calor, não falar de preço, perguntar o motivo principal da procura.
2. QUALIFICAÇÃO — fazer 4 perguntas: (1) há quanto tempo sente isso? (2) afeta mais dor, sono, ansiedade, energia, intestino ou parte emocional? (3) já fez outros tratamentos? (4) o que mais gostaria de melhorar nos próximos 60 dias?
3. VALIDAÇÃO — validar o problema, explicar a abordagem de ${specialty}.
4. PROGRAMA — apresentar o programa com tudo que inclui:
${methodology}
5. REFORÇO DE VALOR — reforçar o diferencial antes de falar o investimento. Muitos pacientes já tentaram tratamentos isolados sem resultado.
6. INVESTIMENTO — apresentar o valor com tudo incluído. ${cityQuestion}
${locationBlock}
Apresente sempre junto com tudo que inclui. Use "investimento", nunca "preço".
7. FECHAMENTO — conduzir para o agendamento: manhã ou tarde? Próximas datas disponíveis.

SE O PACIENTE PEDIR PREÇO ANTES DA HORA: diga que o investimento depende do formato e que antes precisa entender melhor o caso. Redirecione para o acolhimento.

─── LINGUAGEM ───
USE: avaliação personalizada, programa de cuidado, investimento, acompanhamento inicial, leitura profunda do caso.
EVITE: sessão isolada, consulta comum, preço (use investimento), garanto resultado, eu curo.

─── OBJEÇÕES ───
"Achei caro": explique que não é um atendimento avulso — é um processo com avaliação, atendimento estendido, relatórios e acompanhamento. Mostre a opção de entrada.
"Tem desconto?": mostre as opções de formato para encontrar o melhor encaixe. Não desconte o valor principal.
"Quero pensar": resuma o que está incluído e ofereça as próximas datas disponíveis quando estiver pronto.
"Funciona para o meu caso?": cada caso é avaliado individualmente. O atendimento é justamente para entender o que pode estar contribuindo para o quadro.

─── LIMITES ───
NUNCA: diagnosticar, prometer cura, diminuir outros profissionais, usar linguagem de medo.
Se perguntarem sobre diagnóstico: "Cada caso precisa ser avaliado individualmente. O atendimento é justamente para isso."

─── FORMATO ───
Mensagens curtas e naturais, estilo WhatsApp. Máximo 4 parágrafos por mensagem. Emoji discreto quando acolhedor.
${custom_instructions ? `\n─── INSTRUÇÕES ADICIONAIS ───\n${custom_instructions}` : ""}`;
}

// ─── DB operations ────────────────────────────────────────────────────────────

export async function getWhatsAppBotConfig(clinicId: string): Promise<WhatsAppBotConfig | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("whatsapp_bot_configs")
    .select("*")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (!data) return null;
  return { ...data, locations: (data.locations as PricingLocation[]) ?? [] };
}

export async function getWhatsAppBotConfigByNumber(twilioNumber: string): Promise<WhatsAppBotConfig | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("whatsapp_bot_configs")
    .select("*")
    .eq("twilio_number", twilioNumber)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  return { ...data, locations: (data.locations as PricingLocation[]) ?? [] };
}

export async function upsertWhatsAppBotConfig(
  clinicId: string,
  input: Partial<Omit<WhatsAppBotConfig, "id" | "clinic_id">>
): Promise<WhatsAppBotConfig> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("whatsapp_bot_configs")
    .upsert({ clinic_id: clinicId, ...input, updated_at: new Date().toISOString() }, { onConflict: "clinic_id" })
    .select("*")
    .single();
  if (error) throw error;
  return { ...data, locations: (data.locations as PricingLocation[]) ?? [] };
}
