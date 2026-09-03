import { describe, it, expect } from "vitest";
import { needsEmotionalSafeguard } from "@/modules/ai-insights/neuro-enums";

describe("needsEmotionalSafeguard", () => {
  it("dispara quando o eixo Bioemocional está bloqueado (>= 70)", () => {
    expect(needsEmotionalSafeguard(71)).toBe(true);
    expect(needsEmotionalSafeguard(70)).toBe(true);
  });

  it("NÃO dispara com disfunção emocional abaixo de 70", () => {
    expect(needsEmotionalSafeguard(69)).toBe(false);
    expect(needsEmotionalSafeguard(0)).toBe(false);
    expect(needsEmotionalSafeguard(null)).toBe(false);
  });

  it("dispara por flag emocional sensível mesmo com disfunção baixa", () => {
    expect(needsEmotionalSafeguard(20, ["ideacao_suicida"])).toBe(true);
    expect(needsEmotionalSafeguard(20, ["depressao"])).toBe(true);
    expect(needsEmotionalSafeguard(20, ["desesperanca"])).toBe(true);
  });

  it("ignora flags não-emocionais", () => {
    expect(needsEmotionalSafeguard(20, ["gestacao", "condicao_renal"])).toBe(false);
  });
});
