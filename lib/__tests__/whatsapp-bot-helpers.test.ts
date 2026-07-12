import { describe, it, expect, beforeEach } from "vitest";
import {
  stepFromHistory,
  buildFixedReply,
  isPriceQuestion,
  buildPriceObjectionReply,
  detectCity,
  buildPricingBlock,
  buildBookingUrl,
} from "../whatsapp-bot-helpers";
import type { ChatMessage } from "../whatsapp-bot-helpers";
import type { PricingLocation } from "../whatsapp-bot-defaults";
import { metaLangToLocale } from "../whatsapp-bot-defaults";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const LOCATIONS: PricingLocation[] = [
  {
    city: "São Paulo",
    plans: [
      { name: "Essencial", price: "R$ 900", description: "1 sessão", recommended: false },
      { name: "Completo", price: "R$ 1.500", description: "3 sessões", recommended: true },
    ],
  },
  {
    city: "Orlando / EUA",
    plans: [
      { name: "Basic", price: "USD 600", description: "1 session", recommended: false },
      { name: "Complete", price: "USD 1,200", description: "3 sessions", recommended: true },
    ],
  },
  {
    city: "Maringá",
    plans: [{ name: "Completo", price: "R$ 1.200", description: "3 sessões", recommended: true }],
  },
];

const BASE_CONFIG = {
  professional_name: "Dr. Teste",
  clinic_name: "Clínica Teste",
  specialty: "fisioterapia",
  methodology: "método x",
  locations: LOCATIONS,
  language: "pt-BR",
  custom_instructions: "",
  is_active: true,
  clinic_slug: "clinica-teste",
};

// ─── stepFromHistory ──────────────────────────────────────────────────────────

describe("stepFromHistory", () => {
  it("returns DB value when currentStepDb is set", () => {
    const msgs: ChatMessage[] = [];
    expect(stepFromHistory(msgs, 4)).toBe(4);
    expect(stepFromHistory(msgs, 8)).toBe(8);
    expect(stepFromHistory(msgs, 1)).toBe(1);
  });

  it("falls back to counting bot messages when currentStepDb is null", () => {
    const bots = (n: number): ChatMessage[] =>
      Array.from({ length: n }, (_, i) => ({ role: "assistant" as const, content: `bot ${i}` }));

    expect(stepFromHistory([], null)).toBe(1);          // 0 bot msgs → step 1
    expect(stepFromHistory(bots(1), null)).toBe(2);     // 1 bot msg  → step 2
    expect(stepFromHistory(bots(2), null)).toBe(3);     // 2 bot msgs → step 3
    expect(stepFromHistory(bots(3), null)).toBe(4);     // 3 bot msgs → step 4
    expect(stepFromHistory(bots(6), null)).toBe(7);     // 6 bot msgs → step 7
  });

  it("caps at step 8 when ≥ 7 bot messages", () => {
    const msgs: ChatMessage[] = Array.from({ length: 14 }, (_, i) => ({
      role: i % 2 === 0 ? "assistant" : "user",
      content: "x",
    }));
    expect(stepFromHistory(msgs, null)).toBe(8);
  });

  it("DB value of 0 is returned as-is (edge case — should not occur in practice)", () => {
    expect(stepFromHistory([], 0)).toBe(0);
  });
});

// ─── detectCity ───────────────────────────────────────────────────────────────

describe("detectCity", () => {
  it("detects São Paulo from alias 'sp'", () => {
    const loc = detectCity("Estou em sp", LOCATIONS, "pt");
    expect(loc.city).toBe("São Paulo");
  });

  it("detects São Paulo from full name", () => {
    const loc = detectCity("Moro em São Paulo", LOCATIONS, "pt");
    expect(loc.city).toBe("São Paulo");
  });

  it("detects São Paulo from 'sao paulo' (without accent)", () => {
    const loc = detectCity("sao paulo mesmo", LOCATIONS, "pt");
    expect(loc.city).toBe("São Paulo");
  });

  it("detects Orlando from 'orlando'", () => {
    const loc = detectCity("I'm in Orlando", LOCATIONS, "en");
    expect(loc.city).toBe("Orlando / EUA");
  });

  it("detects Orlando from 'florida'", () => {
    const loc = detectCity("I live in Florida", LOCATIONS, "en");
    expect(loc.city).toBe("Orlando / EUA");
  });

  it("detects Orlando from 'eua'", () => {
    const loc = detectCity("moro nos EUA", LOCATIONS, "pt");
    expect(loc.city).toBe("Orlando / EUA");
  });

  it("detects Maringá from alias 'maringa'", () => {
    const loc = detectCity("Sou de Maringa", LOCATIONS, "pt");
    expect(loc.city).toBe("Maringá");
  });

  it("defaults to São Paulo for unrecognized PT city", () => {
    const loc = detectCity("Moro em Curitiba", LOCATIONS, "pt");
    expect(loc.city).toBe("São Paulo");
  });

  it("defaults to Orlando for unrecognized EN city", () => {
    const loc = detectCity("I'm from New York", LOCATIONS, "en");
    expect(loc.city).toBe("Orlando / EUA");
  });
});

// ─── buildPricingBlock ────────────────────────────────────────────────────────

describe("buildPricingBlock", () => {
  it("renders PT label for PT language", () => {
    const block = buildPricingBlock(LOCATIONS[0], "pt");
    expect(block).toContain("*Investimento — São Paulo:*");
  });

  it("renders EN label for EN language", () => {
    const block = buildPricingBlock(LOCATIONS[1], "en");
    expect(block).toContain("*Investment — Orlando / EUA:*");
  });

  it("marks recommended plan with PT label", () => {
    const block = buildPricingBlock(LOCATIONS[0], "pt");
    expect(block).toContain("← recomendado");
    expect(block).not.toContain("← recommended");
  });

  it("marks recommended plan with EN label", () => {
    const block = buildPricingBlock(LOCATIONS[1], "en");
    expect(block).toContain("← recommended");
  });

  it("includes all plans in the block", () => {
    const block = buildPricingBlock(LOCATIONS[0], "pt");
    expect(block).toContain("Essencial");
    expect(block).toContain("Completo");
  });
});

// ─── buildFixedReply ─────────────────────────────────────────────────────────

describe("buildFixedReply", () => {
  it("step 1 PT — contains welcome and asks reason", () => {
    const reply = buildFixedReply(1, "", BASE_CONFIG, "pt");
    expect(reply).toContain("bem-vindo");
    expect(reply).toContain(BASE_CONFIG.professional_name);
    expect(reply).toContain("principal motivo");
  });

  it("step 1 EN — contains welcome in English", () => {
    const reply = buildFixedReply(1, "", BASE_CONFIG, "en");
    expect(reply).toContain("Welcome");
    expect(reply).toContain(BASE_CONFIG.professional_name);
    expect(reply).toContain("main reason");
  });

  it("step 4 PT — contains pricing for detected city (SP)", () => {
    const reply = buildFixedReply(4, "estou em São Paulo", BASE_CONFIG, "pt");
    expect(reply).toContain("Investimento — São Paulo");
    expect(reply).toContain("sessão avulsa");
  });

  it("step 4 EN — contains pricing for detected city (Orlando)", () => {
    const reply = buildFixedReply(4, "I'm in Orlando", BASE_CONFIG, "en");
    expect(reply).toContain("Investment — Orlando / EUA");
    expect(reply).toContain("one-time session");
  });

  it("step 5 PT — asks about morning or afternoon", () => {
    const reply = buildFixedReply(5, "", BASE_CONFIG, "pt");
    expect(reply).toContain("manhã");
    expect(reply).toContain("tarde");
  });

  it("step 5 EN — asks about morning or afternoon in English", () => {
    const reply = buildFixedReply(5, "", BASE_CONFIG, "en");
    expect(reply).toContain("morning");
    expect(reply).toContain("afternoon");
  });

  it("step 6 PT — asks for name", () => {
    const reply = buildFixedReply(6, "", BASE_CONFIG, "pt");
    expect(reply).toContain("nome");
  });

  it("step 6 EN — asks for name in English", () => {
    const reply = buildFixedReply(6, "", BASE_CONFIG, "en");
    expect(reply).toContain("name");
  });

  it("step 7 PT — contains booking URL with correct slug", () => {
    const reply = buildFixedReply(7, "", BASE_CONFIG, "pt");
    expect(reply).toContain("/book/clinica-teste");
    expect(reply).toContain(BASE_CONFIG.professional_name);
  });

  it("step 7 EN — contains booking URL in English", () => {
    const reply = buildFixedReply(7, "", BASE_CONFIG, "en");
    expect(reply).toContain("/book/clinica-teste");
    expect(reply).toContain("contact");
  });

  it("step 7 falls back to 'ifwc' slug when clinic_slug is null", () => {
    const configNoSlug = { ...BASE_CONFIG, clinic_slug: null };
    const reply = buildFixedReply(7, "", configNoSlug, "pt");
    expect(reply).toContain("/book/ifwc");
  });

  it("step 8 PT — confirms contact was sent", () => {
    const reply = buildFixedReply(8, "", BASE_CONFIG, "pt");
    expect(reply).toContain("contato já foi enviado");
  });

  it("step 8 EN — confirms contact was sent in English", () => {
    const reply = buildFixedReply(8, "", BASE_CONFIG, "en");
    expect(reply).toContain("already been sent");
  });

  it("unknown step returns empty string", () => {
    expect(buildFixedReply(99, "", BASE_CONFIG, "pt")).toBe("");
    expect(buildFixedReply(99, "", BASE_CONFIG, "en")).toBe("");
  });
});

// ─── isPriceQuestion ─────────────────────────────────────────────────────────

describe("isPriceQuestion", () => {
  it("detects PT price question 'quanto custa'", () => {
    expect(isPriceQuestion("Quanto custa uma consulta?", "pt")).toBe(true);
  });

  it("detects PT price question 'qual o valor'", () => {
    expect(isPriceQuestion("qual o valor do tratamento?", "pt")).toBe(true);
  });

  it("detects PT price question 'preço'", () => {
    expect(isPriceQuestion("Me fala o preço", "pt")).toBe(true);
  });

  it("returns false for a PT message with no price keywords", () => {
    expect(isPriceQuestion("Oi, quero marcar uma sessão", "pt")).toBe(false);
  });

  it("detects EN price question 'how much'", () => {
    expect(isPriceQuestion("How much does it cost?", "en")).toBe(true);
  });

  it("detects EN price question 'pricing'", () => {
    expect(isPriceQuestion("What's the pricing for the consultation?", "en")).toBe(true);
  });

  it("detects EN price question 'fees'", () => {
    expect(isPriceQuestion("What are the fees?", "en")).toBe(true);
  });

  it("returns false for EN message with no price keywords", () => {
    expect(isPriceQuestion("I'd like to book an appointment", "en")).toBe(false);
  });
});

// ─── buildPriceObjectionReply ─────────────────────────────────────────────────

describe("buildPriceObjectionReply", () => {
  it("PT step 1 — mentions investment and asks reason", () => {
    const reply = buildPriceObjectionReply(1, BASE_CONFIG, "pt");
    expect(reply).toContain("investimento");
    expect(reply).toContain("principal motivo");
    expect(reply).toContain(BASE_CONFIG.professional_name);
  });

  it("PT step 3 — asks which city", () => {
    const reply = buildPriceObjectionReply(3, BASE_CONFIG, "pt");
    expect(reply).toContain("cidade");
  });

  it("PT unknown step — generic fallback question", () => {
    const reply = buildPriceObjectionReply(99, BASE_CONFIG, "pt");
    expect(reply).toContain("como posso te ajudar melhor");
  });

  it("EN step 1 — mentions investment in English and asks reason", () => {
    const reply = buildPriceObjectionReply(1, BASE_CONFIG, "en");
    expect(reply).toContain("investment");
    expect(reply).toContain("main reason");
    expect(reply).toContain(BASE_CONFIG.professional_name);
  });

  it("EN step 3 — asks which city in English", () => {
    const reply = buildPriceObjectionReply(3, BASE_CONFIG, "en");
    expect(reply).toContain("city");
  });

  it("EN unknown step — generic fallback question", () => {
    const reply = buildPriceObjectionReply(99, BASE_CONFIG, "en");
    expect(reply).toContain("how can I best help you");
  });
});

// ─── buildBookingUrl ──────────────────────────────────────────────────────────

describe("buildBookingUrl", () => {
  it("monta o link público de agendamento com o slug da clínica", () => {
    expect(buildBookingUrl("minha-clinica")).toMatch(/\/book\/minha-clinica$/);
  });

  it("sem slug, cai no slug padrão ifwc", () => {
    expect(buildBookingUrl(null)).toMatch(/\/book\/ifwc$/);
    expect(buildBookingUrl(undefined)).toMatch(/\/book\/ifwc$/);
  });
});

describe("metaLangToLocale (idioma do lead nos auto-replies fixos)", () => {
  it("lead em inglês recebe locale en (não o da clínica)", () => {
    expect(metaLangToLocale("en", "pt-BR")).toBe("en");
    expect(metaLangToLocale("en", "pt-PT")).toBe("en");
  });

  it("lead em português respeita a variante da clínica", () => {
    expect(metaLangToLocale("pt", "pt-BR")).toBe("pt-BR");
    expect(metaLangToLocale("pt", "pt-PT")).toBe("pt-PT");
    expect(metaLangToLocale("pt", "en")).toBe("pt-BR");
  });

  it("espanhol cai no inglês (sem template ES próprio)", () => {
    expect(metaLangToLocale("es", "pt-BR")).toBe("en");
  });
});
