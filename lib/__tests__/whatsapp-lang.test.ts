import { describe, it, expect } from "vitest";
import { detectLanguage } from "../whatsapp-lang";

// ─── detectLanguage ───────────────────────────────────────────────────────────

describe("detectLanguage", () => {
  // ── Portuguese messages ───────────────────────────────────────────────────

  it("returns 'pt' for a clear Portuguese greeting", () => {
    expect(detectLanguage([], "Olá, gostaria de saber mais")).toBe("pt");
  });

  it("returns 'pt' for 'bom dia'", () => {
    expect(detectLanguage([], "Bom dia! Quero agendar uma sessão")).toBe("pt");
  });

  it("returns 'pt' for 'boa tarde'", () => {
    expect(detectLanguage([], "Boa tarde, quanto custa?")).toBe("pt");
  });

  it("returns 'pt' for 'preciso de ajuda'", () => {
    expect(detectLanguage([], "preciso de ajuda com dores nas costas")).toBe("pt");
  });

  it("returns 'pt' for message with 'não' and 'sim'", () => {
    expect(detectLanguage([], "Não sei se você pode me ajudar sim")).toBe("pt");
  });

  it("returns 'pt' for message mentioning 'tratamento'", () => {
    expect(detectLanguage([], "Estou buscando um tratamento para ansiedade")).toBe("pt");
  });

  // ── English messages ──────────────────────────────────────────────────────

  it("returns 'en' for a clear English greeting 'hello'", () => {
    expect(detectLanguage([], "Hello, I would like to book an appointment")).toBe("en");
  });

  it("returns 'en' for 'good morning'", () => {
    expect(detectLanguage([], "Good morning! I need help please")).toBe("en");
  });

  it("returns 'en' for 'I have pain'", () => {
    expect(detectLanguage([], "I have pain in my back for months")).toBe("en");
  });

  it("returns 'en' for 'I would like to schedule'", () => {
    expect(detectLanguage([], "I would like to schedule an appointment")).toBe("en");
  });

  it("returns 'en' for strong EN signal: 'I'm looking for treatment'", () => {
    expect(detectLanguage([], "I'm looking for treatment for my anxiety")).toBe("en");
  });

  it("returns 'en' for 'what is the price'", () => {
    expect(detectLanguage([], "What is the price for the consultation?")).toBe("en");
  });

  // ── Defaults to PT ────────────────────────────────────────────────────────

  it("defaults to 'pt' for empty message", () => {
    expect(detectLanguage([], "")).toBe("pt");
  });

  it("defaults to 'pt' for a single ambiguous word like 'sim'", () => {
    expect(detectLanguage([], "sim")).toBe("pt");
  });

  it("defaults to 'pt' for a number-only message", () => {
    expect(detectLanguage([], "123456")).toBe("pt");
  });

  it("defaults to 'pt' when EN score does not exceed PT score by 2", () => {
    // " the " = 1 EN point, 0 PT points → diff = 1 < 2 → still "pt"
    expect(detectLanguage([], "click the button")).toBe("pt");
  });

  // ── Uses history, not current message ────────────────────────────────────

  it("uses the FIRST user message from history, not the current one", () => {
    const history = [
      { role: "user", content: "Olá, preciso de ajuda com tratamento" },
      { role: "assistant", content: "Olá! Pode me contar mais?" },
    ];
    // Current message is English but history says PT
    expect(detectLanguage(history, "hello how much")).toBe("pt");
  });

  it("uses current message when history has no user messages", () => {
    const history = [{ role: "assistant", content: "Olá!" }];
    expect(detectLanguage(history, "Hello I need an appointment")).toBe("en");
  });

  it("uses current message when history is empty", () => {
    expect(detectLanguage([], "I have anxiety and fatigue")).toBe("en");
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  it("returns 'pt' for a PT message that contains 'i' (common false positive)", () => {
    // "ali" contains " i " but only weight 1 — not enough to trigger EN
    expect(detectLanguage([], "estou ali esperando")).toBe("pt");
  });

  it("returns 'pt' for 'do' appearing in Portuguese context (e.g. 'do meu')", () => {
    // 'do' was removed from EN list because it's common in PT
    expect(detectLanguage([], "Gostaria do melhor tratamento")).toBe("pt");
  });
});
