import { describe, it, expect } from "vitest";
import {
  getNoShowPolicyText,
  NO_SHOW_POLICY_VERSION,
  NO_SHOW_POLICY_STATUS,
  POLICY_VERSION_HISTORY,
  type RenderedPolicyLine,
} from "@/modules/no-show-policy/policy-text";

// Junta todo o texto renderizado do documento numa string, para asserts simples.
function flatten(p: ReturnType<typeof getNoShowPolicyText>): string {
  const parts: string[] = [p.title, p.intro, p.checkboxLabel, p.checkboxNote];
  const walkLines = (lines: RenderedPolicyLine[]) => {
    for (const l of lines) {
      parts.push(l.text);
      if (l.sub) walkLines(l.sub);
    }
  };
  for (const s of p.sections) {
    parts.push(s.heading);
    for (const b of s.blocks) {
      if (b.kind === "list") walkLines(b.items);
      else parts.push(b.text);
    }
  }
  return parts.join(" \n ");
}

const IFWC = { windowHours: 24, latePct: 50, noShowPct: 100, lateChargeable: true, noShowChargeable: true, clinicName: "Moreira & Angeli LLC" };

describe("no-show policy text (v3.0)", () => {
  it("é a versão vigente 'no_show_v3.0' com status 'approved'", () => {
    expect(NO_SHOW_POLICY_VERSION).toBe("no_show_v3.0");
    expect(NO_SHOW_POLICY_STATUS).toBe("approved");
    const p = getNoShowPolicyText("en", IFWC);
    expect(p.version).toBe("no_show_v3.0");
    expect(p.status).toBe("approved");
  });

  it("resolve os placeholders com a config da IFWC (24h / 50% / 100%) e não deixa placeholder cru", () => {
    const txt = flatten(getNoShowPolicyText("en", IFWC));
    expect(txt).toContain("24 hours");
    expect(txt).toContain("50%");
    expect(txt).toContain("100%");
    expect(txt).not.toContain("{window_hours}");
    expect(txt).not.toContain("{late_pct}");
    expect(txt).not.toContain("{no_show_pct}");
  });

  it("usa 24h como janela default quando não informada", () => {
    const txt = flatten(getNoShowPolicyText("en"));
    expect(txt).toContain("24 hours");
  });

  it("cai em pt-BR para locale desconhecido; suporta en/pt-PT/es", () => {
    expect(getNoShowPolicyText("xx", IFWC).checkboxLabel).toContain("Reconheço");
    expect(getNoShowPolicyText("en", IFWC).checkboxLabel).toContain("I acknowledge");
    expect(getNoShowPolicyText("pt-PT", IFWC).checkboxLabel).toContain("Marcação");
    expect(getNoShowPolicyText("es", IFWC).checkboxLabel).toContain("Reconozco");
  });

  it("injeta o {clinic_name} (razão social da clínica) em todos os idiomas", () => {
    for (const loc of ["en", "pt-BR", "pt-PT", "es"]) {
      const txt = flatten(getNoShowPolicyText(loc, IFWC));
      expect(txt).toContain("Moreira & Angeli LLC");
      expect(txt).not.toContain("{clinic_name}");
    }
  });

  it("templatiza o nome: outra clínica renderiza a própria razão social", () => {
    const txt = flatten(getNoShowPolicyText("en", { ...IFWC, clinicName: "Acme Wellness LLC" }));
    expect(txt).toContain("Acme Wellness LLC");
    expect(txt).not.toContain("Moreira & Angeli LLC");
    expect(txt).not.toContain("{clinic_name}");
  });

  it("usa um rótulo genérico por idioma quando nenhum nome é informado (fallback)", () => {
    const en = flatten(getNoShowPolicyText("en"));
    expect(en).toContain("our clinic");
    expect(en).not.toContain("{clinic_name}");
    const ptBR = flatten(getNoShowPolicyText("pt-BR"));
    expect(ptBR).toContain("a clínica");
  });

  it("omite a cláusula de no-show quando a clínica não cobra falta (mode='none')", () => {
    const txt = flatten(getNoShowPolicyText("en", { ...IFWC, noShowChargeable: false }));
    expect(txt).not.toContain("100%");
    expect(txt).not.toContain("No-Show Fee");
    // a cláusula de cancelamento tardio permanece
    expect(txt).toContain("50%");
  });

  it("omite a cláusula de cancelamento tardio quando mode='none'", () => {
    const txt = flatten(getNoShowPolicyText("en", { ...IFWC, lateChargeable: false }));
    expect(txt).not.toContain("50%");
    expect(txt).toContain("100%");
  });

  it("mantém a v1.0 arquivada no histórico de versões (não invalida aceites passados)", () => {
    expect(POLICY_VERSION_HISTORY["no_show_v1.0"]).toBeDefined();
    expect(POLICY_VERSION_HISTORY["no_show_v1.0"].status).toBe("superseded");
    expect(POLICY_VERSION_HISTORY["no_show_v3.0"].status).toBe("approved");
  });
});
