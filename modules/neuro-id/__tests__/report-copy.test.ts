import { describe, it, expect } from "vitest";
import {
  buildPatientReportCopy, findProhibited, copyBandForDysfunction,
  type CopyBand, type CopyPillar, type ReportVars,
} from "../report-copy";

const BANDS: CopyBand[] = ["solto", "tenso", "bloqueado"];
const PILLARS: CopyPillar[] = ["fisico", "bioquimico", "emocional"];

function vars(overrides: Partial<ReportVars> = {}): ReportVars {
  return { nome: "Ana", indice: 48, pilar: "Bioemocional", hint: "mente & emoção", q1: "dor de cabeça", q2: "insônia", sintoma: "sono ruim", ...overrides };
}

function allText(c: ReturnType<typeof buildPatientReportCopy>): string {
  return [...c.beats.map((b) => `${b.title} ${b.body}`), c.authority, c.socialProof, c.disclaimer, c.safeguard ?? ""].join(" \n ");
}

describe("copyBandForDysfunction", () => {
  it("0–30 solto · 31–69 tenso · 70–100 bloqueado", () => {
    expect(copyBandForDysfunction(20)).toBe("solto");
    expect(copyBandForDysfunction(48)).toBe("tenso");
    expect(copyBandForDysfunction(80)).toBe("bloqueado");
  });
});

describe("buildPatientReportCopy", () => {
  it("retorna 7 beats sem placeholders soltos, em toda faixa × pilar", () => {
    for (const band of BANDS) for (const pillar of PILLARS) {
      const c = buildPatientReportCopy({ band, pillar, vars: vars(), showSafeguard: false });
      expect(c.beats).toHaveLength(7);
      const text = allText(c);
      expect(text).not.toMatch(/\{[a-z0-9]+\}/i); // nenhum {placeholder} restou
    }
  });

  it("ZERO termos proibidos em toda combinação", () => {
    for (const band of BANDS) for (const pillar of PILLARS) {
      const c = buildPatientReportCopy({ band, pillar, vars: vars(), showSafeguard: true });
      expect(findProhibited(allText(c))).toEqual([]);
    }
  });

  it("varia por faixa (beat 2 difere) e por pilar (beat 4 difere)", () => {
    const a = buildPatientReportCopy({ band: "solto", pillar: "emocional", vars: vars(), showSafeguard: false });
    const b = buildPatientReportCopy({ band: "bloqueado", pillar: "emocional", vars: vars(), showSafeguard: false });
    expect(a.beats[1].body).not.toBe(b.beats[1].body);
    const p1 = buildPatientReportCopy({ band: "tenso", pillar: "fisico", vars: vars(), showSafeguard: false });
    const p2 = buildPatientReportCopy({ band: "tenso", pillar: "emocional", vars: vars(), showSafeguard: false });
    expect(p1.beats[3].body).not.toBe(p2.beats[3].body);
  });

  it("salvaguarda só quando showSafeguard; cita a queixa real (q1)", () => {
    const withSafe = buildPatientReportCopy({ band: "bloqueado", pillar: "emocional", vars: vars(), showSafeguard: true });
    expect(withSafe.safeguard).toContain("CVV 188");
    const without = buildPatientReportCopy({ band: "tenso", pillar: "fisico", vars: vars(), showSafeguard: false });
    expect(without.safeguard).toBeNull();
    expect(withSafe.beats[0].body).toContain("dor de cabeça");
  });

  it("sem queixa registrada → beat 1 honesto (não inventa)", () => {
    const c = buildPatientReportCopy({ band: "tenso", pillar: "fisico", vars: vars({ q1: null, q2: null, sintoma: null }), showSafeguard: false });
    expect(c.beats[0].body).not.toContain("Você falou sobre");
    expect(c.beats[0].body).toContain("a gente ouviu você");
  });
});

describe("findProhibited (palavra inteira)", () => {
  it("flagra termos proibidos", () => {
    expect(findProhibited("garantia de cura em 100%")).toEqual(expect.arrayContaining(["cura", "garantia", "100%"]));
  });
  it("NÃO flagra 'procure' (não é 'cura')", () => {
    expect(findProhibited("procure avaliação médica")).toEqual([]);
  });
});
