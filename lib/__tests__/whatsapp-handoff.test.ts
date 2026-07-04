import { describe, it, expect } from "vitest";
import {
  HUMAN_HANDOFF_WINDOW_MS,
  handoffStatus,
  isHumanWindowActive,
  shouldSilenceAi,
} from "@/lib/whatsapp-handoff";

const NOW = Date.parse("2026-07-04T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 60 * 60 * 1000).toISOString();

describe("whatsapp-handoff", () => {
  it("IA ativa: sem pausa e sem mensagem humana recente", () => {
    const state = { aiPaused: false, botDisabled: false, lastHumanMessageAt: null };
    expect(shouldSilenceAi(state, NOW)).toBe(false);
    expect(handoffStatus(state, NOW)).toBe("active");
  });

  it("ai_paused silencia a IA e mostra 'paused'", () => {
    const state = { aiPaused: true, botDisabled: false, lastHumanMessageAt: null };
    expect(shouldSilenceAi(state, NOW)).toBe(true);
    expect(handoffStatus(state, NOW)).toBe("paused");
  });

  it("bot_disabled (legado) também silencia a IA", () => {
    const state = { aiPaused: false, botDisabled: true, lastHumanMessageAt: null };
    expect(shouldSilenceAi(state, NOW)).toBe(true);
    expect(handoffStatus(state, NOW)).toBe("paused");
  });

  it("mensagem humana há menos de 24h silencia a IA ('with_team')", () => {
    const state = { aiPaused: false, botDisabled: false, lastHumanMessageAt: hoursAgo(23) };
    expect(shouldSilenceAi(state, NOW)).toBe(true);
    expect(handoffStatus(state, NOW)).toBe("with_team");
  });

  it("mensagem humana há mais de 24h devolve a conversa para a IA", () => {
    const state = { aiPaused: false, botDisabled: false, lastHumanMessageAt: hoursAgo(25) };
    expect(shouldSilenceAi(state, NOW)).toBe(false);
    expect(handoffStatus(state, NOW)).toBe("active");
  });

  it("pausa manual tem prioridade sobre a janela de 24h no status", () => {
    const state = { aiPaused: true, botDisabled: false, lastHumanMessageAt: hoursAgo(1) };
    expect(handoffStatus(state, NOW)).toBe("paused");
  });

  it("limite exato de 24h fecha a janela", () => {
    const at = new Date(NOW - HUMAN_HANDOFF_WINDOW_MS).toISOString();
    expect(isHumanWindowActive(at, NOW)).toBe(false);
  });

  it("timestamp inválido não silencia a IA", () => {
    expect(isHumanWindowActive("nao-e-data", NOW)).toBe(false);
    expect(
      shouldSilenceAi({ aiPaused: false, botDisabled: false, lastHumanMessageAt: "nao-e-data" }, NOW),
    ).toBe(false);
  });
});
