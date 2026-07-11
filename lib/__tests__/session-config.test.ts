import { describe, it, expect } from "vitest";
import {
  coerceSessionConfig,
  slugifyVital,
  DEFAULT_SESSION_CONFIG,
} from "../../modules/session/session-config";

describe("coerceSessionConfig", () => {
  it("returns the default config for null/garbage input", () => {
    expect(coerceSessionConfig(null)).toEqual(DEFAULT_SESSION_CONFIG);
    expect(coerceSessionConfig(undefined)).toEqual(DEFAULT_SESSION_CONFIG);
    expect(coerceSessionConfig("nope")).toEqual(DEFAULT_SESSION_CONFIG);
    expect(coerceSessionConfig(42)).toEqual(DEFAULT_SESSION_CONFIG);
  });

  it("clamps scaleMax to 2–10 and falls back to 5 when invalid", () => {
    expect(coerceSessionConfig({ scaleMax: 1, vitals: [{ key: "dor", color: "#E05252" }] }).scaleMax).toBe(5);
    expect(coerceSessionConfig({ scaleMax: 99, vitals: [{ key: "dor", color: "#E05252" }] }).scaleMax).toBe(5);
    expect(coerceSessionConfig({ scaleMax: 10, vitals: [{ key: "dor", color: "#E05252" }] }).scaleMax).toBe(10);
    expect(coerceSessionConfig({ scaleMax: "x", vitals: [{ key: "dor", color: "#E05252" }] }).scaleMax).toBe(5);
  });

  it("keeps the default vitals when the vitals array is empty", () => {
    expect(coerceSessionConfig({ scaleMax: 7, vitals: [] }).vitals).toEqual(DEFAULT_SESSION_CONFIG.vitals);
  });

  it("derives a key from the label when key is missing, and dedups", () => {
    const cfg = coerceSessionConfig({
      scaleMax: 5,
      vitals: [
        { label: "Nível de Dor", color: "#E05252" },
        { label: "nível de dor", color: "#000000" }, // same slug → deduped
      ],
    });
    expect(cfg.vitals).toHaveLength(1);
    expect(cfg.vitals[0].key).toBe("nivel_de_dor");
  });

  it("rejects invalid colors, falling back to a neutral hex", () => {
    const cfg = coerceSessionConfig({ scaleMax: 5, vitals: [{ key: "dor", color: "red" }] });
    expect(cfg.vitals[0].color).toBe("#6B6A66");
  });

  it("caps at 12 vitals", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ key: `v${i}`, color: "#0F6E56" }));
    expect(coerceSessionConfig({ scaleMax: 5, vitals: many }).vitals).toHaveLength(12);
  });
});

describe("slugifyVital", () => {
  it("strips accents, lowercases and underscores", () => {
    expect(slugifyVital("Nível de Dor")).toBe("nivel_de_dor");
    expect(slugifyVital("  Ânimo / Humor  ")).toBe("animo_humor");
    expect(slugifyVital("Sono!!!")).toBe("sono");
  });
});
