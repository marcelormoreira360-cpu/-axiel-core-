import { describe, it, expect } from "vitest";
import {
  parseSlotChoice,
  parsePeriodPreference,
  formatSlotOptions,
  type OfferedSlot,
} from "@/lib/clara-booking-helpers";

describe("parseSlotChoice", () => {
  it("reconhece dígitos dentro do intervalo", () => {
    expect(parseSlotChoice("1", 3)).toBe(0);
    expect(parseSlotChoice("2", 3)).toBe(1);
    expect(parseSlotChoice("3", 3)).toBe(2);
  });

  it("reconhece dígito em frase", () => {
    expect(parseSlotChoice("quero o 2 por favor", 3)).toBe(1);
    expect(parseSlotChoice("opção 3", 3)).toBe(2);
  });

  it("reconhece ordinais em português", () => {
    expect(parseSlotChoice("o primeiro", 3)).toBe(0);
    expect(parseSlotChoice("segunda opção", 3)).toBe(1);
    expect(parseSlotChoice("o terceiro horário", 3)).toBe(2);
  });

  it("reconhece ordinais em inglês", () => {
    expect(parseSlotChoice("the first one", 3)).toBe(0);
    expect(parseSlotChoice("second please", 3)).toBe(1);
    expect(parseSlotChoice("third", 3)).toBe(2);
  });

  it("rejeita escolha fora do intervalo", () => {
    expect(parseSlotChoice("3", 2)).toBe(-1);
    expect(parseSlotChoice("o terceiro", 2)).toBe(-1);
  });

  it("devolve -1 para texto sem escolha", () => {
    expect(parseSlotChoice("não sei", 3)).toBe(-1);
    expect(parseSlotChoice("", 3)).toBe(-1);
    expect(parseSlotChoice("qualquer um", 3)).toBe(-1);
  });

  it("devolve -1 quando count é zero", () => {
    expect(parseSlotChoice("1", 0)).toBe(-1);
  });
});

describe("parsePeriodPreference", () => {
  it("detecta manhã (PT)", () => {
    expect(parsePeriodPreference("prefiro de manhã")).toBe("morning");
    expect(parsePeriodPreference("pode ser cedo")).toBe("morning");
  });

  it("detecta tarde (PT)", () => {
    expect(parsePeriodPreference("melhor à tarde")).toBe("afternoon");
  });

  it("detecta morning / afternoon (EN)", () => {
    expect(parsePeriodPreference("morning works")).toBe("morning");
    expect(parsePeriodPreference("in the afternoon")).toBe("afternoon");
  });

  it("devolve null sem sinal ou ambíguo", () => {
    expect(parsePeriodPreference("tanto faz")).toBeNull();
    expect(parsePeriodPreference("manhã ou tarde")).toBeNull();
    expect(parsePeriodPreference("")).toBeNull();
  });
});

describe("formatSlotOptions", () => {
  const slots: OfferedSlot[] = [
    { iso: "2026-09-12T13:00:00.000Z", label: "Quinta, 12/09 às 10:00" },
    { iso: "2026-09-13T17:00:00.000Z", label: "Sexta, 13/09 às 14:00" },
  ];

  it("numera as opções em linhas separadas", () => {
    expect(formatSlotOptions(slots)).toBe(
      "1) Quinta, 12/09 às 10:00\n2) Sexta, 13/09 às 14:00",
    );
  });

  it("lista vazia vira string vazia", () => {
    expect(formatSlotOptions([])).toBe("");
  });
});
