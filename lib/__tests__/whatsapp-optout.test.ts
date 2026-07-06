import { describe, it, expect } from "vitest";
import { isOptOutRequest } from "@/lib/whatsapp-optout";

describe("whatsapp-optout (falar com atendente)", () => {
  it("detecta pedidos claros em português", () => {
    expect(isOptOutRequest("quero falar com um atendente")).toBe(true);
    expect(isOptOutRequest("Posso falar com uma pessoa?")).toBe(true);
    expect(isOptOutRequest("prefiro atendimento humano")).toBe(true);
    expect(isOptOutRequest("me passa pra recepção? quero falar com a recepcao")).toBe(true);
  });

  it("ignora acentos e caixa alta", () => {
    expect(isOptOutRequest("QUERO FALAR COM ATENDENTE")).toBe(true);
    expect(isOptOutRequest("Falar com alguém da clínica")).toBe(true);
  });

  it("detecta pedidos em inglês", () => {
    expect(isOptOutRequest("I want to talk to a human")).toBe(true);
    expect(isOptOutRequest("Can I speak to someone?")).toBe(true);
    expect(isOptOutRequest("give me a real person please")).toBe(true);
  });

  it("não dispara em conversa clínica normal", () => {
    expect(isOptOutRequest("quero parar de sentir dor")).toBe(false);
    expect(isOptOutRequest("qual o valor da avaliação?")).toBe(false);
    expect(isOptOutRequest("tenho dores no ombro há 3 meses")).toBe(false);
    expect(isOptOutRequest("how much does it cost?")).toBe(false);
  });
});
