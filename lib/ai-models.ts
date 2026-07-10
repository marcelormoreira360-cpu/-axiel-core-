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
