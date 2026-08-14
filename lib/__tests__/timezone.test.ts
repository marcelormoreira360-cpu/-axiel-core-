import { describe, it, expect } from "vitest";
import {
  isValidTimezone,
  inferTimezoneFromCountry,
  inferTimezoneFromPhone,
  resolvePatientTimezone,
  timezoneLabel,
  formatDualTime,
  dualTimeText,
} from "../timezone";

// Instante fixo: 20/08/2026 09:00 em America/New_York (EDT, UTC-4) = 13:00 UTC.
// No Brasil (America/Sao_Paulo, UTC-3) o mesmo instante é 10:00.
const ISO = "2026-08-20T13:00:00.000Z";

describe("isValidTimezone", () => {
  it("aceita IANA válido e rejeita lixo", () => {
    expect(isValidTimezone("America/Sao_Paulo")).toBe(true);
    expect(isValidTimezone("America/New_York")).toBe(true);
    expect(isValidTimezone("Marte/Olympus")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
    expect(isValidTimezone(null)).toBe(false);
    expect(isValidTimezone(undefined)).toBe(false);
  });
});

describe("inferência por país e telefone", () => {
  it("país", () => {
    expect(inferTimezoneFromCountry("BR")).toBe("America/Sao_Paulo");
    expect(inferTimezoneFromCountry("br")).toBe("America/Sao_Paulo");
    expect(inferTimezoneFromCountry("US")).toBe("America/New_York");
    expect(inferTimezoneFromCountry("PT")).toBe("Europe/Lisbon");
    expect(inferTimezoneFromCountry("ZZ")).toBeNull();
    expect(inferTimezoneFromCountry(null)).toBeNull();
  });

  it("telefone por DDI, casando o mais longo primeiro", () => {
    expect(inferTimezoneFromPhone("+55 44 99999-0000")).toBe("America/Sao_Paulo");
    expect(inferTimezoneFromPhone("0055 44 99999-0000")).toBe("America/Sao_Paulo");
    expect(inferTimezoneFromPhone("+1 (407) 555-0000")).toBe("America/New_York");
    expect(inferTimezoneFromPhone("+351 912 000 000")).toBe("Europe/Lisbon");
    expect(inferTimezoneFromPhone("912000000")).toBeNull(); // sem DDI reconhecível
    expect(inferTimezoneFromPhone(null)).toBeNull();
  });
});

describe("resolvePatientTimezone (precedência)", () => {
  it("valor salvo vence tudo", () => {
    expect(
      resolvePatientTimezone({ stored: "Europe/Lisbon", country: "BR", phone: "+55 44 9", fallback: "America/New_York" }),
    ).toBe("Europe/Lisbon");
  });
  it("telefone vence país", () => {
    expect(
      resolvePatientTimezone({ stored: null, country: "US", phone: "+55 44 9", fallback: "America/New_York" }),
    ).toBe("America/Sao_Paulo");
  });
  it("país quando não há telefone", () => {
    expect(
      resolvePatientTimezone({ stored: null, country: "BR", phone: null, fallback: "America/New_York" }),
    ).toBe("America/Sao_Paulo");
  });
  it("fallback (clínica) quando nada infere", () => {
    expect(
      resolvePatientTimezone({ stored: "lixo", country: null, phone: null, fallback: "America/New_York" }),
    ).toBe("America/New_York");
  });
});

describe("timezoneLabel", () => {
  it("rótulos conhecidos por locale", () => {
    expect(timezoneLabel("America/Sao_Paulo", "pt-BR")).toBe("Brasília");
    expect(timezoneLabel("America/New_York", "pt-BR")).toBe("Nova York");
    expect(timezoneLabel("America/New_York", "en")).toBe("New York");
    expect(timezoneLabel("America/New_York", "pt-PT")).toBe("Nova Iorque");
  });
  it("fallback = cidade do nome IANA", () => {
    expect(timezoneLabel("America/Recife", "pt-BR")).toBe("Recife");
    expect(timezoneLabel("Asia/Tokyo", "en")).toBe("Tokyo");
  });
});

describe("formatDualTime", () => {
  it("paciente no Brasil vê 10:00, clínica em NY vê 09:00", () => {
    const dt = formatDualTime({ iso: ISO, patientTz: "America/Sao_Paulo", clinicTz: "America/New_York", locale: "pt-BR" });
    expect(dt.patient.time).toBe("10:00");
    expect(dt.clinic.time).toBe("09:00");
    expect(dt.patient.label).toBe("Brasília");
    expect(dt.clinic.label).toBe("Nova York");
    expect(dt.sameZone).toBe(false);
  });

  it("colapsa quando paciente e clínica estão no mesmo fuso", () => {
    const dt = formatDualTime({ iso: ISO, patientTz: "America/New_York", clinicTz: "America/New_York", locale: "pt-BR" });
    expect(dt.sameZone).toBe(true);
    expect(dt.patient.time).toBe(dt.clinic.time);
  });

  it("colapsa quando fusos diferentes têm o mesmo offset no instante", () => {
    // America/Sao_Paulo e America/Argentina/Buenos_Aires ambos UTC-3 nessa data.
    const dt = formatDualTime({ iso: ISO, patientTz: "America/Sao_Paulo", clinicTz: "America/Argentina/Buenos_Aires", locale: "pt-BR" });
    expect(dt.patient.time).toBe(dt.clinic.time);
    expect(dt.sameZone).toBe(true);
  });
});

describe("dualTimeText", () => {
  it("texto duplo pt-BR", () => {
    const txt = dualTimeText({ iso: ISO, patientTz: "America/Sao_Paulo", clinicTz: "America/New_York", locale: "pt-BR" });
    expect(txt).toContain("10:00 no seu horário (Brasília)");
    expect(txt).toContain("09:00 na clínica (Nova York)");
  });
  it("texto único quando mesmo fuso", () => {
    const txt = dualTimeText({ iso: ISO, patientTz: "America/New_York", clinicTz: "America/New_York", locale: "pt-BR" });
    expect(txt).toContain("09:00 (Nova York)");
    expect(txt).not.toContain("na clínica");
  });
});
