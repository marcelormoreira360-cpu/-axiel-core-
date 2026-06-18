import { describe, it, expect } from "vitest";
import { interpolateTemplate, buildMessage } from "../automation-helpers";

// ─── interpolateTemplate ──────────────────────────────────────────────────────

describe("interpolateTemplate", () => {
  const ISO_DATE = "2026-06-15T14:30:00.000Z"; // 14:30 UTC → "11:30" in pt-BR (UTC-3)

  it("replaces {{nome}} with firstName", () => {
    const result = interpolateTemplate("Olá, {{nome}}!", "João", null);
    expect(result).toBe("Olá, João!");
  });

  it("replaces all occurrences of {{nome}}", () => {
    const result = interpolateTemplate("{{nome}}, {{nome}}, oi!", "Ana", null);
    expect(result).toBe("Ana, Ana, oi!");
  });

  it("replaces {{horario}} with formatted time when startsAt is provided", () => {
    const result = interpolateTemplate("Às {{horario}}", "Maria", ISO_DATE);
    // Locale formatting is environment-dependent; just verify placeholder is gone
    expect(result).not.toContain("{{horario}}");
    expect(result).toContain(":");  // time always contains a colon
  });

  it("replaces {{horario}} with fallback when startsAt is null", () => {
    const result = interpolateTemplate("Às {{horario}}", "Pedro", null);
    expect(result).toBe("Às horário agendado");
  });

  it("replaces {{data}} with formatted date when startsAt is provided", () => {
    const result = interpolateTemplate("Em {{data}}", "Carla", ISO_DATE);
    expect(result).not.toContain("{{data}}");
    expect(result.length).toBeGreaterThan("Em ".length);
  });

  it("replaces {{data}} with fallback when startsAt is null", () => {
    const result = interpolateTemplate("Em {{data}}", "Lucas", null);
    expect(result).toBe("Em data agendada");
  });

  it("replaces all three placeholders in one template", () => {
    const tpl = "Olá {{nome}}, sua sessão é em {{data}} às {{horario}}.";
    const result = interpolateTemplate(tpl, "Beatriz", ISO_DATE);
    expect(result).not.toContain("{{nome}}");
    expect(result).not.toContain("{{data}}");
    expect(result).not.toContain("{{horario}}");
    expect(result).toContain("Beatriz");
  });

  it("leaves template unchanged when no placeholders are present", () => {
    const tpl = "Mensagem sem variáveis.";
    expect(interpolateTemplate(tpl, "Carlos", ISO_DATE)).toBe(tpl);
  });
});

// ─── buildMessage ─────────────────────────────────────────────────────────────

describe("buildMessage", () => {
  const ISO_DATE = "2026-06-15T10:00:00.000Z";

  it("d-1: includes first name and 'amanhã'", () => {
    const msg = buildMessage("d-1", "João Silva", ISO_DATE);
    expect(msg).toContain("João");
    expect(msg).toContain("amanhã");
    expect(msg).not.toContain("Silva");
  });

  it("d-1: includes formatted time when startsAt is provided", () => {
    const msg = buildMessage("d-1", "João", ISO_DATE);
    expect(msg).not.toContain("horário agendado");
    expect(msg).toMatch(/\d{2}:\d{2}/); // HH:MM pattern
  });

  it("d-1: falls back to 'horário agendado' when startsAt is null", () => {
    const msg = buildMessage("d-1", "João", null);
    expect(msg).toContain("horário agendado");
  });

  it("nps: includes first name and NPS-related text", () => {
    const msg = buildMessage("nps", "Maria Santos", null);
    expect(msg).toContain("Maria");
    expect(msg).toContain("sessão de ontem");
    expect(msg).toContain("Responda");
  });

  it("d+3: includes first name and follow-up text", () => {
    const msg = buildMessage("d+3", "Pedro Costa", null);
    expect(msg).toContain("Pedro");
    expect(msg).toContain("alguns dias");
  });

  it("d+30: includes first name and 30-day text", () => {
    const msg = buildMessage("d+30", "Ana Oliveira", null);
    expect(msg).toContain("Ana");
    expect(msg).toContain("30 dias");
  });

  it("unknown tag: falls back to d+30 message", () => {
    const msg = buildMessage("unknown", "Carlos", null);
    // Falls through to the d+30 return
    expect(msg).toContain("Carlos");
    expect(msg).toContain("30 dias");
  });

  it("handles single-word full name (no split crash)", () => {
    expect(() => buildMessage("nps", "Mono", null)).not.toThrow();
    const msg = buildMessage("nps", "Mono", null);
    expect(msg).toContain("Mono");
  });

  it("uses only first name even when full name has many words", () => {
    const msg = buildMessage("d-1", "Maria Joana da Silva Santos", ISO_DATE);
    expect(msg).toContain("Maria");
    expect(msg).not.toContain("Joana");
    expect(msg).not.toContain("Santos");
  });
});
