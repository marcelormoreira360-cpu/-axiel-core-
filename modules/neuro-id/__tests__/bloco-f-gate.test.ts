import { describe, it, expect, afterEach } from "vitest";
import { localizeForm, isBlocoFEnabled } from "@/modules/neuro-id/form-i18n";

// Bloco F = pilar emocional / saúde mental (inclui o item de ideação suicida). A trava é
// fail-closed: sem NEURO_ID_BLOCO_F_ENABLED="true", o pilar emocional NÃO é servido ao
// paciente. Este teste garante que a trava não regrida silenciosamente.
const servesEmotional = (locale: "pt-BR" | "en") =>
  localizeForm(locale).blocks.some((b) => b.pillar === "emocional");

describe("Neuro ID — trava técnica do Bloco F", () => {
  afterEach(() => {
    delete process.env.NEURO_ID_BLOCO_F_ENABLED;
  });

  it("por padrão (fail-closed) NÃO serve o pilar emocional em pt nem en", () => {
    delete process.env.NEURO_ID_BLOCO_F_ENABLED;
    expect(isBlocoFEnabled()).toBe(false);
    expect(servesEmotional("pt-BR")).toBe(false);
    expect(servesEmotional("en")).toBe(false);
  });

  it("só serve o pilar emocional com NEURO_ID_BLOCO_F_ENABLED=\"true\"", () => {
    process.env.NEURO_ID_BLOCO_F_ENABLED = "true";
    expect(isBlocoFEnabled()).toBe(true);
    expect(servesEmotional("pt-BR")).toBe(true);
    expect(servesEmotional("en")).toBe(true);
  });
});
