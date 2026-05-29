/**
 * Pure helper functions for the WhatsApp bot logic.
 * Extracted from app/api/meta/whatsapp/route.ts so they can be unit-tested
 * without importing Next.js / Supabase dependencies.
 */

import type { Lang } from "@/lib/whatsapp-lang";
import type { PricingLocation } from "@/lib/whatsapp-bot-defaults";
import { IFWC_DEFAULT_CONFIG } from "@/lib/whatsapp-bot-defaults";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type BotConfig = typeof IFWC_DEFAULT_CONFIG & { clinic_slug?: string | null };

// ─── Step derivation ──────────────────────────────────────────────────────────

/**
 * Derives the current conversation step.
 * Prefers the DB-persisted `current_step` (immune to history truncation).
 * Falls back to counting assistant messages when DB value is unavailable.
 *
 * 0 bot replies → step 1 (welcome)
 * 1 → step 2   (qualification questions)
 * 2 → step 3   (present program + ask city)
 * 3 → step 4   (show prices)
 * 4 → step 5   (morning / afternoon?)
 * 5 → step 6   (ask name)
 * 6 → step 7   (confirm + scheduling link)
 * 7+ → step 8  (terminal — already confirmed)
 */
export function stepFromHistory(
  messages: ChatMessage[],
  currentStepDb: number | null
): number {
  if (currentStepDb !== null) return currentStepDb;
  const botCount = messages.filter((m) => m.role === "assistant").length;
  if (botCount >= 7) return 8;
  return botCount + 1;
}

// ─── City detection ───────────────────────────────────────────────────────────

// City aliases — avoids relying on single-word partial match (QUA-05 fix)
export const CITY_ALIASES: Record<string, string[]> = {
  "Orlando / EUA": [
    "orlando", "florida", "miami", "tampa", "usa", "eua", "estados unidos",
    "united states", "america", " us ", "u.s.", "fl ",
  ],
  "São Paulo": ["são paulo", "sao paulo", "sampa", "sp "],
  "Maringá": ["maringá", "maringa", "pr "],
};

export function detectCity(
  text: string,
  locations: PricingLocation[],
  lang: Lang
): PricingLocation {
  const lower = ` ${text.toLowerCase()} `;

  for (const loc of locations) {
    const aliases = CITY_ALIASES[loc.city] ?? [loc.city.toLowerCase()];
    if (aliases.some((alias) => lower.includes(alias))) return loc;
  }

  if (lang === "en") return locations.find((l) => l.city.includes("Orlando")) ?? locations[0];
  return locations.find((l) => l.city.includes("São Paulo")) ?? locations[0];
}

// ─── Pricing block ────────────────────────────────────────────────────────────

export function buildPricingBlock(location: PricingLocation, lang: Lang): string {
  const label    = lang === "en" ? "Investment" : "Investimento";
  const recLabel = lang === "en" ? " ← recommended" : " ← recomendado";
  const lines = location.plans.map(
    (p) => `• ${p.name}: ${p.price}${p.recommended ? recLabel : ""} — ${p.description}`
  );
  return `*${label} — ${location.city}:*\n${lines.join("\n")}`;
}

// ─── Fixed step templates ─────────────────────────────────────────────────────

export function buildFixedReply(
  step: number,
  userText: string,
  config: BotConfig,
  lang: Lang
): string {
  const { professional_name, locations } = config;
  const bookingSlug = config.clinic_slug ?? "ifwc";

  if (lang === "en") {
    switch (step) {
      case 1:
        return `Hello! Welcome 🙏 ${professional_name}'s service is a personalized integrative evaluation — not a standalone session. It analyzes the body, nervous system, bioemotional factors, and functional health.\nTell me: what's the main reason you're reaching out today?`;

      case 4: {
        const location    = detectCity(userText, locations, lang);
        const pricingBlock = buildPricingBlock(location, lang);
        return `${pricingBlock}\n\nThis includes a full evaluation, extended session, exams, reports, and follow-up care — not a one-time session. The recommended option (←) is best suited for most cases.`;
      }

      case 5:
        return `Based on what you've shared, this format is the most suitable for your case 😊 Would you prefer a morning or afternoon appointment?`;

      case 6:
        return `Great! What's your name so I can reserve your spot? 😊`;

      case 7: {
        const bookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://axiel-core-6ikl.vercel.app"}/book/${bookingSlug}`;
        return `Perfect! I'll forward your contact to ${professional_name} 🙏\n\nIf you'd like to secure your date, you can book directly here:\n👉 ${bookUrl}\n\nWe'll be in touch soon to confirm 😊`;
      }

      case 8:
        return `Your contact has already been sent to ${professional_name} 🙏 They'll be in touch soon. If you need anything else, just let me know!`;

      default:
        return "";
    }
  }

  // PT-BR templates
  switch (step) {
    case 1:
      return `Olá! Seja muito bem-vindo(a) 🙏 O atendimento do ${professional_name} é uma avaliação integrativa personalizada — não é uma sessão isolada. Analisa corpo, sistema nervoso, parte bioemocional e fatores funcionais.\nMe conta: qual é o principal motivo que te trouxe aqui agora?`;

    case 4: {
      const location    = detectCity(userText, locations, lang);
      const pricingBlock = buildPricingBlock(location, lang);
      return `${pricingBlock}\n\nIsso inclui avaliação, sessão estendida, exames, relatórios e acompanhamento — não é sessão avulsa. O formato recomendado (←) é o mais indicado para a maioria dos casos.`;
    }

    case 5:
      return `Pelo que você me contou, esse formato é o mais indicado para o seu caso 😊 Para você seria melhor no período da manhã ou da tarde?`;

    case 6:
      return `Ótimo! Qual é o seu nome para eu reservar a data? 😊`;

    case 7: {
      const bookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://axiel-core-6ikl.vercel.app"}/book/${bookingSlug}`;
      return `Perfeito! Vou passar seu contato para ${professional_name} 🙏\n\nSe quiser já garantir sua data, você pode agendar diretamente por aqui:\n👉 ${bookUrl}\n\nEm breve entraremos em contato para confirmar 😊`;
    }

    case 8:
      return `Seu contato já foi enviado ao ${professional_name} 🙏 Em breve ele entra em contato. Se precisar de algo mais, é só avisar!`;

    default:
      return "";
  }
}

// ─── Price objection guard ────────────────────────────────────────────────────

export function isPriceQuestion(text: string, lang: Lang): boolean {
  const lower = text.toLowerCase();
  if (lang === "en") {
    return ["how much", "what's the cost", "what is the cost", "the price", "pricing", "cost?", "fees", "fee?", "rates", "charges"].some(
      (k) => lower.includes(k)
    );
  }
  return ["quanto custa", "qual o valor", "qual o preço", "preço", "valor", "custa"].some(
    (k) => lower.includes(k)
  );
}

export function buildPriceObjectionReply(
  currentStep: number,
  config: BotConfig,
  lang: Lang
): string {
  if (lang === "en") {
    const nextQuestions: Record<number, string> = {
      1: "what's the main reason you're reaching out?",
      2: "which symptoms are you hoping to improve?",
      3: "which city are you in?",
      5: "do you prefer mornings or afternoons?",
      6: "what's your name?",
    };
    const nextQ = nextQuestions[currentStep] ?? "how can I best help you?";
    return `Sure! The investment varies based on format and location. It includes a full evaluation, extended session, exams, reports, and follow-up with ${config.professional_name}. To give you the right numbers: ${nextQ}`;
  }
  const nextQuestions: Record<number, string> = {
    1: "qual é o principal motivo que te trouxe aqui?",
    2: "quais sintomas você quer melhorar?",
    3: "você está em qual cidade?",
    5: "você prefere manhã ou tarde?",
    6: "qual é o seu nome?",
  };
  const nextQ = nextQuestions[currentStep] ?? "como posso te ajudar melhor?";
  return `Claro! O investimento varia conforme o formato e a cidade. Inclui avaliação, sessão estendida, exames, relatórios e acompanhamento de ${config.professional_name}. Para te passar os valores certos: ${nextQ}`;
}
