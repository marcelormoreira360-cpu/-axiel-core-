// Instrução de idioma para prompts de IA — arquitetura de DOIS NÍVEIS:
// - Material INTERNO (equipe lê: sugestão ATM, insight financeiro, resumo de
//   teleconsulta, analytics) segue o idioma da CLÍNICA (locale da UI).
// - Material do PACIENTE (AI Insight/relatórios, síntese de exame que entra no
//   Relatório Funcional) segue patients.locale via resolvePatientLocale.
// Default pt-BR quando o locale é desconhecido (preserva o comportamento atual).
import { DEFAULT_LOCALE } from "@/i18n/locales";

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  "pt-BR": "Escreva TODO o texto gerado em português brasileiro (pt-BR).",
  "pt-PT": "Escreva TODO o texto gerado em português europeu (pt-PT).",
  en: "Write ALL generated text in English (US English).",
};

/** Frase de idioma para injetar nos prompts. Locale ausente/desconhecido → pt-BR. */
export function languageInstruction(locale: string | null | undefined): string {
  return LANGUAGE_INSTRUCTIONS[locale ?? DEFAULT_LOCALE] ?? LANGUAGE_INSTRUCTIONS[DEFAULT_LOCALE];
}
