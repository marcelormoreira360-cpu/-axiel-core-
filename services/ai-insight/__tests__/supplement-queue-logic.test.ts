import { describe, it, expect } from "vitest";
import type { AiInsight, AiInsightOutput } from "@/lib/types";
import {
  currentSupplementVersion,
  resolveJobStatusAfterFailure,
  isSupplementSent,
  shouldNudgeRegeneration,
} from "@/services/ai-insight/supplement-queue-logic";

const VER = "2026-09-suplementacao-10-filtros";

const out = (v: string | null): AiInsightOutput =>
  ({ supplement_reasoning_version: v } as unknown as AiInsightOutput);

const insight = (over: Partial<AiInsight>): AiInsight => ({ ...over } as AiInsight);

describe("currentSupplementVersion", () => {
  it("null quando não há insight", () => {
    expect(currentSupplementVersion(null)).toBeNull();
  });
  it("usa final_output com precedência sobre output", () => {
    expect(currentSupplementVersion(insight({ final_output: out(VER), output: out("antiga") }))).toBe(VER);
  });
  it("cai para output quando não há final_output", () => {
    expect(currentSupplementVersion(insight({ final_output: null, output: out("antiga") }))).toBe("antiga");
  });
  it("null quando o output não tem carimbo", () => {
    expect(currentSupplementVersion(insight({ final_output: null, output: out(null) }))).toBeNull();
  });
});

describe("resolveJobStatusAfterFailure", () => {
  it("volta para pending enquanto houver tentativa", () => {
    expect(resolveJobStatusAfterFailure(1, 3)).toBe("pending");
    expect(resolveJobStatusAfterFailure(2, 3)).toBe("pending");
  });
  it("vira failed ao esgotar max_attempts", () => {
    expect(resolveJobStatusAfterFailure(3, 3)).toBe("failed");
    expect(resolveJobStatusAfterFailure(4, 3)).toBe("failed");
  });
});

describe("isSupplementSent", () => {
  it("true se qualquer canal enviou", () => {
    expect(isSupplementSent("sent", "failed")).toBe(true);
    expect(isSupplementSent("skipped_no_contact", "sent")).toBe(true);
  });
  it("false se nenhum canal enviou", () => {
    expect(isSupplementSent("skipped_no_contact", "no_report")).toBe(false);
    expect(isSupplementSent("failed", "failed")).toBe(false);
  });
});

describe("shouldNudgeRegeneration", () => {
  it("true se há qualquer trabalho (atualizar, fila ou enviar)", () => {
    expect(shouldNudgeRegeneration(3, 0, 0)).toBe(true);
    expect(shouldNudgeRegeneration(0, 2, 0)).toBe(true);
    expect(shouldNudgeRegeneration(0, 0, 1)).toBe(true);
  });
  it("false quando não há nada a fazer", () => {
    expect(shouldNudgeRegeneration(0, 0, 0)).toBe(false);
  });
});
