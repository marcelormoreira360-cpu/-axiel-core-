import { describe, it, expect } from "vitest";
import {
  normalizeRetentionCountry,
  retentionYears,
  anonymizeEligibleAt,
  isAnonymizeEligible,
  MIN_RETENTION_YEARS,
} from "@/modules/compliance/retention-policy";

const NOW = new Date("2026-09-08T00:00:00Z");
const yearsAgo = (n: number) => {
  const d = new Date(NOW.getTime());
  d.setFullYear(d.getFullYear() - n);
  return d;
};

describe("retention-policy — normalização de país (texto livre)", () => {
  it("mapeia variantes de Brasil → BR (20 anos)", () => {
    for (const c of ["Brasil", "Brazil", "brasil ", "BR"]) {
      expect(normalizeRetentionCountry(c)).toBe("BR");
      expect(retentionYears(c)).toBe(20);
    }
  });
  it("mapeia variantes de EUA → US (7 anos)", () => {
    for (const c of ["Estados Unidos", "United States", "USA", "us", "EUA"]) {
      expect(normalizeRetentionCountry(c)).toBe("US");
      expect(retentionYears(c)).toBe(7);
    }
  });
  it("país desconhecido/vazio → OTHER, com prazo conservador de 20 anos", () => {
    expect(normalizeRetentionCountry(null)).toBe("OTHER");
    expect(normalizeRetentionCountry("")).toBe("OTHER");
    expect(retentionYears(null)).toBe(20);
    expect(retentionYears("Portugal")).toBe(20);
  });
  it("MIN_RETENTION_YEARS é 7 (menor prazo possível)", () => {
    expect(MIN_RETENTION_YEARS).toBe(7);
  });
});

describe("retention-policy — elegibilidade a anonimizar", () => {
  it("US: elegível 7 anos após o último contato, não antes", () => {
    const eight = { country: "Estados Unidos", lastContact: yearsAgo(8) };
    const six = { country: "Estados Unidos", lastContact: yearsAgo(6) };
    expect(isAnonymizeEligible(eight, NOW)).toBe(true);
    expect(isAnonymizeEligible(six, NOW)).toBe(false);
  });

  it("BR: não elegível com 8 anos (precisa de 20)", () => {
    const eight = { country: "Brasil", lastContact: yearsAgo(8) };
    const twentyOne = { country: "Brasil", lastContact: yearsAgo(21) };
    expect(isAnonymizeEligible(eight, NOW)).toBe(false);
    expect(isAnonymizeEligible(twentyOne, NOW)).toBe(true);
  });

  it("país desconhecido usa 20 anos (conservador)", () => {
    expect(isAnonymizeEligible({ country: null, lastContact: yearsAgo(10) }, NOW)).toBe(false);
    expect(isAnonymizeEligible({ country: null, lastContact: yearsAgo(21) }, NOW)).toBe(true);
  });

  it("menor de idade (US): estende até 18 + 7, mesmo com último contato antigo", () => {
    // Criança que teve último contato há 8 anos, mas nasceu há 12 anos: ainda menor,
    // só elegível em (18+7)=25 anos após o nascimento → não elegível agora.
    const child = { country: "Estados Unidos", lastContact: yearsAgo(8), dateOfBirth: yearsAgo(12) };
    expect(isAnonymizeEligible(child, NOW)).toBe(false);
    // Adulto nascido há 40 anos, último contato há 8 anos: elegível (piso de menor não aplica).
    const adult = { country: "Estados Unidos", lastContact: yearsAgo(8), dateOfBirth: yearsAgo(40) };
    expect(isAnonymizeEligible(adult, NOW)).toBe(true);
  });

  it("anonymizeEligibleAt devolve a data-limite correta (US, 7 anos)", () => {
    const at = anonymizeEligibleAt({ country: "us", lastContact: new Date("2020-01-01T00:00:00Z") });
    expect(at.toISOString().slice(0, 10)).toBe("2027-01-01");
  });
});
