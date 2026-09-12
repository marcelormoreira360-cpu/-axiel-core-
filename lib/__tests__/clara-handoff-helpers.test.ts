import { describe, it, expect } from "vitest";
import { detectHandoffRequest } from "@/lib/clara-handoff-helpers";

describe("detectHandoffRequest", () => {
  it("detecta pedido explícito de humano (PT)", () => {
    expect(detectHandoffRequest("quero falar com um atendente")).toBe("human");
    expect(detectHandoffRequest("posso falar com uma pessoa?")).toBe("human");
    expect(detectHandoffRequest("não quero falar com robô")).toBe("human");
    expect(detectHandoffRequest("tem algum atendente aí?")).toBe("human");
  });

  it("detecta pedido de humano (EN/ES)", () => {
    expect(detectHandoffRequest("talk to a human please")).toBe("human");
    expect(detectHandoffRequest("I want a real person")).toBe("human");
    expect(detectHandoffRequest("quiero hablar con una persona")).toBe("human");
  });

  it("detecta desconto", () => {
    expect(detectHandoffRequest("tem desconto?")).toBe("discount");
    expect(detectHandoffRequest("vocês dão cupom?")).toBe("discount");
    expect(detectHandoffRequest("any discount available?")).toBe("discount");
  });

  it("detecta cobrança/reembolso", () => {
    expect(detectHandoffRequest("quero um reembolso")).toBe("billing");
    expect(detectHandoffRequest("a cobrança veio errada")).toBe("billing");
    expect(detectHandoffRequest("I need a refund")).toBe("billing");
  });

  it("NÃO dispara em conversa normal nem em objeção de preço", () => {
    expect(detectHandoffRequest("estou com dor nas costas")).toBeNull();
    expect(detectHandoffRequest("quero agendar")).toBeNull();
    expect(detectHandoffRequest("está caro")).toBeNull();
    expect(detectHandoffRequest("")).toBeNull();
  });
});
