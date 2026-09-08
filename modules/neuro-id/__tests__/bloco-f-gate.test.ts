import { describe, it, expect, afterEach } from "vitest";
import { localizeForm, isBlocoFEnabled } from "@/modules/neuro-id/form-i18n";

// Bloco F = pilar emocional / saúde mental (inclui o item de ideação suicida). Por decisão
// de Marcelo, a coleta CONTINUA normal: default LIGADO. O gate é só um kill-switch opcional
// (desliga apenas com NEURO_ID_BLOCO_F_ENABLED="false"). Este teste garante que o padrão
// preserva a captação e que a chave de desligamento funciona se um dia for necessária.
const servesEmotional = (locale: "pt-BR" | "en") =>
  localizeForm(locale).blocks.some((b) => b.pillar === "emocional");

describe("Neuro ID — kill-switch opcional do Bloco F (default ligado)", () => {
  afterEach(() => {
    delete process.env.NEURO_ID_BLOCO_F_ENABLED;
  });

  it("por padrão SERVE o pilar emocional em pt e en (coleta preservada)", () => {
    delete process.env.NEURO_ID_BLOCO_F_ENABLED;
    expect(isBlocoFEnabled()).toBe(true);
    expect(servesEmotional("pt-BR")).toBe(true);
    expect(servesEmotional("en")).toBe(true);
  });

  it("só deixa de servir o pilar emocional se NEURO_ID_BLOCO_F_ENABLED=\"false\"", () => {
    process.env.NEURO_ID_BLOCO_F_ENABLED = "false";
    expect(isBlocoFEnabled()).toBe(false);
    expect(servesEmotional("pt-BR")).toBe(false);
    expect(servesEmotional("en")).toBe(false);
  });
});
