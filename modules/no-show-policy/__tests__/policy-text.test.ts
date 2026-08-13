import { describe, it, expect } from "vitest";
import { getNoShowPolicyText, NO_SHOW_POLICY_VERSION } from "@/modules/no-show-policy/policy-text";

describe("no-show policy text (v1.0)", () => {
  it("substitui a janela {hours} pela config da clínica (sem divergir do sistema)", () => {
    const p = getNoShowPolicyText("pt-BR", 48);
    expect(p.body).toContain("48 horas");
    expect(p.body).not.toContain("{hours}");
    expect(p.version).toBe(NO_SHOW_POLICY_VERSION);
  });

  it("usa 24h como default", () => {
    expect(getNoShowPolicyText("en").body).toContain("24 hours");
  });

  it("cai em pt-BR para locale desconhecido; suporta en/pt-PT/es", () => {
    expect(getNoShowPolicyText("xx").accept).toContain("Li e concordo");
    expect(getNoShowPolicyText("en").accept).toContain("I have read");
    expect(getNoShowPolicyText("pt-PT").accept).toContain("marcação");
    expect(getNoShowPolicyText("es").accept).toContain("He leído");
  });
});
