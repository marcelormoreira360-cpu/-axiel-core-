// Seleção de modelo OpenAI por finalidade. Antes, um único OPENAI_MODEL cobria
// tudo: como estava setado em "gpt-4.1-mini", os BOTS de conversa (que deviam
// rodar no mais barato gpt-4o-mini) acabavam no 4.1-mini. Agora há dois grupos:
//
//   - CHAT: conversa de alto volume (WhatsApp/Instagram/Facebook/voz) e geração
//     leve de insights/analytics. Barato por padrão (gpt-4o-mini).
//   - REPORT: trabalho clínico/estruturado (escriba SOAP, exames, ai-insight,
//     resumo de teleconsulta, health-agent). Mais capaz (gpt-4.1-mini).
//
// Cada grupo é sobreponível por env própria; REPORT mantém compat com o antigo
// OPENAI_MODEL para não mudar o comportamento atual desse grupo.

export function chatModel(): string {
  return process.env.OPENAI_MODEL_CHAT ?? "gpt-4o-mini";
}

export function reportModel(): string {
  return process.env.OPENAI_MODEL_REPORT ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
}

// DEEP REPORT: só a geração do ENTREGÁVEL clínico (relatório Neuro ID Doc 1 +
// suplementação Doc 2/3). Raciocínio caso a caso pede um modelo mais forte que o
// gpt-4.1-mini — por padrão um modelo de raciocínio (o4-mini). Sobreponível por env
// dedicada (não herda OPENAI_MODEL_REPORT p/ não voltar ao mini sem querer). Os
// auxiliares leves (rascunho ATM, resumo do caso) seguem em reportModel().
export function deepReportModel(): string {
  return process.env.OPENAI_MODEL_REPORT_DEEP ?? "o4-mini";
}

// Modelos de raciocínio (série "o": o1/o3/o4-mini…) não aceitam `temperature` e
// usam `reasoning_effort`. Detecta pelo nome para montar os parâmetros certos.
export function isReasoningModel(model: string): boolean {
  return /^o\d/i.test(model);
}

// Esforço de raciocínio do deep report (low|medium|high). Default "medium".
export function reasoningEffort(): "low" | "medium" | "high" {
  const v = (process.env.OPENAI_REASONING_EFFORT ?? "medium").toLowerCase();
  return v === "low" || v === "high" ? v : "medium";
}
